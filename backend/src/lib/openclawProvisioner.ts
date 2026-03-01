import { createHash, createHmac } from "node:crypto";

type ProvisionStatus = "pending" | "ready" | "failed";

interface UserOpenClawState {
  userId: string;
  instanceName: string;
  endpoint: string | null;
  authToken: string;
  status: ProvisionStatus;
  lastError: string | null;
  updatedAt: string;
}

const stateByUser = new Map<string, UserOpenClawState>();
const inFlight = new Set<string>();

function nowIso(): string {
  return new Date().toISOString();
}

function safeUserFragment(userId: string): string {
  return userId.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "user";
}

function makeInstanceName(userId: string): string {
  const prefix = process.env.OPENCLAW_INSTANCE_PREFIX ?? "openclaw-u";
  const frag = safeUserFragment(userId);
  const hash = createHash("sha1").update(userId).digest("hex").slice(0, 8);
  return `${prefix}-${frag}-${hash}`.slice(0, 62);
}

function deriveBridgeToken(userId: string): string {
  const secret = process.env.OPENCLAW_BRIDGE_TOKEN_SALT ?? process.env.JWT_SECRET ?? "";
  if (!secret) {
    throw new Error("OPENCLAW_BRIDGE_TOKEN_SALT or JWT_SECRET is required");
  }
  return createHmac("sha256", secret).update(userId).digest("hex");
}

function parseIsoMs(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

function isPendingExpired(updatedAt: string): boolean {
  const elapsed = Date.now() - parseIsoMs(updatedAt);
  return elapsed > 180_000;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMetadataToken(): Promise<string> {
  const metadataUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  const res = await fetch(metadataUrl, { headers: { "Metadata-Flavor": "Google" } });
  if (!res.ok) {
    throw new Error(`metadata token error: ${res.status}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("metadata token missing");
  }
  return json.access_token;
}

async function getAccessToken(): Promise<string> {
  if (process.env.GCP_ACCESS_TOKEN) {
    return process.env.GCP_ACCESS_TOKEN;
  }
  return await fetchMetadataToken();
}

function gceConfig() {
  return {
    enabled: (process.env.OPENCLAW_DEDICATED_ENABLED ?? "false").toLowerCase() === "true",
    projectId: process.env.GCP_PROJECT_ID ?? "",
    zone: process.env.OPENCLAW_GCE_ZONE ?? "",
    template: process.env.OPENCLAW_INSTANCE_TEMPLATE ?? "",
    port: Number.parseInt(process.env.OPENCLAW_PORT ?? "8080", 10),
  };
}

async function gceApi(path: string, init: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return await fetch(`https://compute.googleapis.com/compute/v1/${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

async function readTemplateMetadataItems(templateRef: string): Promise<Array<{ key: string; value: string }>> {
  if (!templateRef) return [];
  const token = await getAccessToken();
  const url = templateRef.startsWith("https://")
    ? templateRef
    : `https://compute.googleapis.com/compute/v1/${templateRef.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`read template failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    properties?: { metadata?: { items?: Array<{ key?: string; value?: string }> } };
  };
  const items = json.properties?.metadata?.items ?? [];
  return items
    .filter((i) => typeof i.key === "string")
    .map((i) => ({ key: String(i.key), value: String(i.value ?? "") }));
}

interface GceOperation {
  name?: string;
  status?: string;
  error?: {
    errors?: Array<{ code?: string; message?: string }>;
  };
}

async function waitForZoneOperation(projectId: string, zone: string, operationName: string): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const res = await gceApi(`projects/${projectId}/zones/${zone}/operations/${operationName}`, { method: "GET" });
    if (!res.ok) {
      throw new Error(`get operation failed: ${res.status}`);
    }
    const op = (await res.json()) as GceOperation;
    if (op.status === "DONE") {
      const opErr = op.error?.errors?.[0];
      if (opErr?.code || opErr?.message) {
        throw new Error(`operation failed: ${opErr.code ?? "UNKNOWN"} ${opErr.message ?? ""}`.trim());
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`operation timeout: ${operationName}`);
}

async function getInstanceIp(projectId: string, zone: string, instanceName: string): Promise<string | null> {
  const res = await gceApi(`projects/${projectId}/zones/${zone}/instances/${instanceName}`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get instance failed: ${res.status}`);
  const json = (await res.json()) as {
    status?: string;
    networkInterfaces?: Array<{ accessConfigs?: Array<{ natIP?: string }> }>;
  };
  const ip = json.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP ?? null;
  if (json.status !== "RUNNING") return null;
  return ip;
}

async function getInstanceStatus(projectId: string, zone: string, instanceName: string): Promise<string | null> {
  const res = await gceApi(`projects/${projectId}/zones/${zone}/instances/${instanceName}`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get instance status failed: ${res.status}`);
  const json = (await res.json()) as { status?: string };
  return json.status ?? null;
}

async function createInstanceIfNeeded(
  projectId: string,
  zone: string,
  template: string,
  instanceName: string,
  bridgeToken: string,
): Promise<void> {
  const existingStatus = await getInstanceStatus(projectId, zone, instanceName).catch(() => null);
  if (existingStatus) return;

  const templateMetadata = await readTemplateMetadataItems(template);
  const metadataMap = new Map<string, string>();
  for (const item of templateMetadata) {
    metadataMap.set(item.key, item.value);
  }
  metadataMap.set("openclaw_auth_token", bridgeToken);

  const body = {
    name: instanceName,
    metadata: {
      items: Array.from(metadataMap.entries()).map(([key, value]) => ({ key, value })),
    },
  };
  const templateQ = encodeURIComponent(template);
  const res = await gceApi(
    `projects/${projectId}/zones/${zone}/instances?sourceInstanceTemplate=${templateQ}`,
    {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    return;
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`create instance failed: ${res.status} ${detail}`);
  }
  const op = (await res.json()) as GceOperation;
  if (!op.name) {
    throw new Error("create instance failed: operation name missing");
  }
  await waitForZoneOperation(projectId, zone, op.name);
}

async function waitForEndpoint(projectId: string, zone: string, instanceName: string, port: number): Promise<string> {
  let lastKnownStatus = "UNKNOWN";
  let notFoundStreak = 0;
  for (let i = 0; i < 72; i += 1) {
    const status = await getInstanceStatus(projectId, zone, instanceName).catch(() => null);
    if (status) {
      lastKnownStatus = status;
      notFoundStreak = 0;
    } else {
      notFoundStreak += 1;
      if (notFoundStreak >= 12) {
        throw new Error(`instance not found after creation: ${instanceName}`);
      }
    }
    const ip = await getInstanceIp(projectId, zone, instanceName).catch(() => null);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: "openclaw_provision_wait",
        instance_name: instanceName,
        attempt: i + 1,
        instance_status: lastKnownStatus,
        has_ip: Boolean(ip),
      }),
    );
    if (ip) {
      const endpoint = `http://${ip}:${port}`;
      try {
        const health = await fetchWithTimeout(`${endpoint}/healthz`, 3000);
        if (health.ok) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ event: "openclaw_provision_ready", instance_name: instanceName, endpoint }));
          return endpoint;
        }
      } catch {
        // VM起動直後は疎通できないことがあるため継続待機する
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`instance endpoint timeout: instance=${instanceName} status=${lastKnownStatus}`);
}

async function provisionDedicatedInstance(userId: string): Promise<UserOpenClawState> {
  const cfg = gceConfig();
  const instanceName = makeInstanceName(userId);
  const authToken = deriveBridgeToken(userId);
  const base: UserOpenClawState = {
    userId,
    instanceName,
    endpoint: null,
    authToken,
    status: "pending",
    lastError: null,
    updatedAt: nowIso(),
  };
  stateByUser.set(userId, base);

  if (!cfg.enabled || !cfg.projectId || !cfg.zone || !cfg.template) {
    const ready: UserOpenClawState = {
      ...base,
      endpoint: null,
      status: "failed",
      lastError: "専用OpenClawプロビジョニング設定が不足しています",
      updatedAt: nowIso(),
    };
    stateByUser.set(userId, ready);
    return ready;
  }

  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: "openclaw_provision_start", user_id: userId, instance_name: instanceName }));
    await createInstanceIfNeeded(cfg.projectId, cfg.zone, cfg.template, instanceName, authToken);
    const endpoint = await waitForEndpoint(cfg.projectId, cfg.zone, instanceName, cfg.port);
    const ready: UserOpenClawState = {
      ...base,
      endpoint,
      status: "ready",
      updatedAt: nowIso(),
    };
    stateByUser.set(userId, ready);
    return ready;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: "openclaw_provision_failed",
        user_id: userId,
        instance_name: instanceName,
        error: err instanceof Error ? err.message : "provision failed",
      }),
    );
    const failed: UserOpenClawState = {
      ...base,
      status: "failed",
      lastError: err instanceof Error ? err.message : "provision failed",
      updatedAt: nowIso(),
    };
    stateByUser.set(userId, failed);
    return failed;
  }
}

export async function refreshUserOpenClawState(userId: string): Promise<UserOpenClawState> {
  const cfg = gceConfig();
  const instanceName = makeInstanceName(userId);
  const current = stateByUser.get(userId);
  if (!cfg.enabled || !cfg.projectId || !cfg.zone || !cfg.template) {
    const failed: UserOpenClawState = {
      userId,
      instanceName,
      endpoint: null,
      authToken: deriveBridgeToken(userId),
      status: "failed",
      lastError: "専用OpenClawプロビジョニング設定が不足しています",
      updatedAt: nowIso(),
    };
    stateByUser.set(userId, failed);
    return failed;
  }

  if (current?.status === "ready" && current.endpoint) {
    const health = await fetchWithTimeout(`${current.endpoint.replace(/\/$/, "")}/healthz`, 3000).catch(() => null);
    if (health?.ok) {
      return current;
    }
  }

  const ip = await getInstanceIp(cfg.projectId, cfg.zone, instanceName).catch(() => null);
  const authToken = current?.authToken ?? deriveBridgeToken(userId);
  if (ip) {
    const endpoint = `http://${ip}:${cfg.port}`;
    const health = await fetchWithTimeout(`${endpoint}/healthz`, 3000).catch(() => null);
    const next: UserOpenClawState = {
      userId,
      instanceName,
      endpoint: health?.ok ? endpoint : null,
      authToken,
      status: health?.ok ? "ready" : "pending",
      lastError: null,
      updatedAt: nowIso(),
    };
    stateByUser.set(userId, next);
    return next;
  }

  return ensureUserProvisioning(userId);
}

export async function getUserOpenClawState(userId: string): Promise<UserOpenClawState | null> {
  return await refreshUserOpenClawState(userId);
}

export async function getUserOpenClawEndpoint(userId: string): Promise<string | null> {
  const state = await refreshUserOpenClawState(userId);
  if (state.status !== "ready") return null;
  return state.endpoint;
}

export async function getUserOpenClawConnection(userId: string): Promise<{ endpoint: string; authToken: string } | null> {
  const state = await refreshUserOpenClawState(userId);
  if (state.status !== "ready" || !state.endpoint) {
    return null;
  }
  return { endpoint: state.endpoint, authToken: state.authToken };
}

export function ensureUserProvisioning(userId: string): UserOpenClawState {
  const current = stateByUser.get(userId);
  if (current?.status === "ready") {
    return current;
  }
  if (current?.status === "pending" && !isPendingExpired(current.updatedAt)) {
    return current;
  }

  const instanceName = makeInstanceName(userId);
  const pending: UserOpenClawState = {
    userId,
    instanceName,
    endpoint: null,
    authToken: deriveBridgeToken(userId),
    status: "pending",
    lastError: null,
    updatedAt: nowIso(),
  };
  stateByUser.set(userId, pending);

  if (!inFlight.has(userId)) {
    inFlight.add(userId);
    provisionDedicatedInstance(userId).finally(() => inFlight.delete(userId));
  }
  return pending;
}
