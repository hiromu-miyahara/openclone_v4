#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-macro-resolver-488810-p8}"
TEMPLATE_NAME="${TEMPLATE_NAME:-openclaw-template-v3}"
VM_SERVICE_ACCOUNT="${VM_SERVICE_ACCOUNT:-openclaw-vm-sa@${PROJECT_ID}.iam.gserviceaccount.com}"
MISTRAL_MODEL_REF="${MISTRAL_MODEL_REF:-mistral/mistral-large-latest}"
OPENCLAW_PORT="${OPENCLAW_PORT:-8080}"
OPENCLAW_VERSION="${OPENCLAW_VERSION:-2026.2.26}"

TMP_SCRIPT="$(mktemp)"
cat > "${TMP_SCRIPT}" <<SCRIPT
#!/bin/bash
set -euo pipefail

apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release python3 git

PROJECT_ID="${PROJECT_ID}"
MISTRAL_MODEL_REF="${MISTRAL_MODEL_REF}"
OPENCLAW_PORT="${OPENCLAW_PORT}"
OPENCLAW_VERSION="${OPENCLAW_VERSION}"

TOKEN=\$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" | \
  python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

MISTRAL_API_KEY=\$(curl -s -H "Authorization: Bearer \${TOKEN}" \
  "https://secretmanager.googleapis.com/v1/projects/\${PROJECT_ID}/secrets/mistral-api-key/versions/latest:access" | \
  python3 -c 'import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)["payload"]["data"]).decode())')
OPENCLAW_BRIDGE_TOKEN=\$(curl -fsS -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/openclaw_auth_token" || true)

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

npm install -g "openclaw@\${OPENCLAW_VERSION}"

openclaw --profile runtime onboard \
  --non-interactive \
  --accept-risk \
  --auth-choice mistral-api-key \
  --mistral-api-key "\${MISTRAL_API_KEY}" \
  --skip-channels \
  --skip-ui \
  --skip-skills \
  --skip-daemon \
  --skip-health \
  --flow quickstart \
  --mode local

openclaw --profile runtime models set "\${MISTRAL_MODEL_REF}"

# OpenClawのsystem-prompt.tsにJSON出力要件を追加
OPENCLAW_PKG_DIR="/usr/local/lib/node_modules/openclaw"
SYSTEM_PROMPT_FILE="\${OPENCLAW_PKG_DIR}/dist/agents/system-prompt.js"
if [ -f "\${SYSTEM_PROMPT_FILE}" ]; then
  # 既存のsystem-prompt.jsの末尾にJSON出力要件を追記
  echo "" >> "\${SYSTEM_PROMPT_FILE}"
  echo "// OpenClone JSON Output Requirement" >> "\${SYSTEM_PROMPT_FILE}"
  echo "export const OPENCLONE_JSON_INSTRUCTION = \`" >> "\${SYSTEM_PROMPT_FILE}"
  echo "You must respond with JSON containing:" >> "\${SYSTEM_PROMPT_FILE}"
  echo "- text: Your conversational response" >> "\${SYSTEM_PROMPT_FILE}"
  echo "- actions: Array where LAST element must be \"speaking\"" >> "\${SYSTEM_PROMPT_FILE}"
  echo "- Before \"speaking\", add 0-2 reactions: nod, agree, surprised, emphasis, thinking, joy, anger, melancholy, fun" >> "\${SYSTEM_PROMPT_FILE}"
  echo "Example: {\"text\": \"Great!\", \"actions\": [\"agree\", \"joy\", \"speaking\"]}" >> "\${SYSTEM_PROMPT_FILE}"
  echo "\`;" >> "\${SYSTEM_PROMPT_FILE}"
  echo "JSON output requirement added to system-prompt.js" || echo "Warning: Failed to modify system-prompt.js"
else
  echo "Warning: system-prompt.js not found at \${SYSTEM_PROMPT_FILE}"
fi

mkdir -p /opt/openclaw-bridge
cat > /opt/openclaw-bridge/server.mjs <<'JS'
import http from "node:http";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";

const port = Number.parseInt(process.env.OPENCLAW_PORT ?? "8080", 10);
const fixedTo = process.env.OPENCLAW_FIXED_TO ?? "+15555550123";
const bridgeToken = process.env.OPENCLAW_BRIDGE_TOKEN ?? "";
const maxBody = 1024 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function extractJsonBlock(raw) {
  const t = String(raw ?? "").trim();
  const idx = t.lastIndexOf("\n{");
  const candidate = idx >= 0 ? t.slice(idx + 1) : t;
  if (!candidate.startsWith("{")) {
    const first = t.indexOf("{");
    if (first < 0) return null;
    return t.slice(first);
  }
  return candidate;
}

function sessionToAddress(sessionId) {
  const raw = String(sessionId ?? "").trim();
  if (!raw) {
    return fixedTo;
  }
  const hash = createHash("sha1").update(raw).digest("hex");
  let digits = "";
  for (const c of hash) {
    digits += (parseInt(c, 16) % 10).toString();
    if (digits.length >= 10) break;
  }
  return "+1" + digits.padEnd(10, "0");
}

function runOpenClawAgent(text, toAddress) {
  return new Promise((resolve, reject) => {
    const args = [
      "--profile",
      "runtime",
      "agent",
      "--local",
      "--to",
      toAddress,
      "--message",
      text,
      "--json",
    ];
    execFile("openclaw", args, { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error("openclaw execution failed: " + (stderr || stdout || err.message)));
        return;
      }
      const jsonBlock = extractJsonBlock(stdout);
      if (!jsonBlock) {
        reject(new Error("openclaw json output not found"));
        return;
      }
      try {
        const parsed = JSON.parse(jsonBlock);
        // OpenClawの標準出力: { payloads: [{ text: string }] }
        // または、JSON出力要件が反映されている場合: { text: string, actions: string[] }
        const textOut = parsed?.payloads?.[0]?.text || parsed?.text;
        if (!textOut || typeof textOut !== "string") {
          reject(new Error("openclaw response text missing"));
          return;
        }
        // actionsがあれば返す、なければundefined（呼び出し元でフォールバック）
        resolve({ text: textOut, actions: parsed?.actions });
      } catch (e) {
        reject(new Error("openclaw json parse failed: " + String(e)));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  // SOUL更新エンドポイント
  if (req.method === "POST" && req.url === "/v1/update-soul") {
    if (bridgeToken) {
      const headerToken = String(req.headers["x-openclaw-token"] ?? "");
      if (headerToken !== bridgeToken) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }
    }

    let size = 0;
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBody) {
        req.destroy(new Error("payload too large"));
        return;
      }
      raw += chunk;
    });
    req.on("error", () => {
      sendJson(res, 400, { error: "request_read_error" });
      return;
    });
    req.on("end", async () => {
      let body;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        sendJson(res, 400, { error: "invalid_json" });
        return;
      }

      const soul = body.soul;
      if (!soul || typeof soul !== "string") {
        sendJson(res, 400, { error: "soul is required" });
        return;
      }

      try {
        // OpenClawのsystem-prompt.jsにSOULを追記
        const OPENCLAW_PKG_DIR = "/usr/local/lib/node_modules/openclaw";
        const SYSTEM_PROMPT_FILE = `${OPENCLAW_PKG_DIR}/dist/agents/system-prompt.js`;

        // 既存の内容をバックアップ
        try {
          const backup = await fs.readFile(SYSTEM_PROMPT_FILE, 'utf8');
          await fs.writeFile(`${SYSTEM_PROMPT_FILE}.backup`, backup);
        } catch (e) {
          // バックアップ失敗は続行
        }

        // SOULコンテンツを追記
        const soulEntry = `\\n\\n// PERSONA SOUL (generated at ${new Date().toISOString()})
export const PERSONA_SOUL = \\`
${soul.replace(/`/g, "\\`").replace(/\$/g, "\\$")}
\\`;
`;

        await fs.appendFile(SYSTEM_PROMPT_FILE, soulEntry);

        sendJson(res, 200, { success: true, message: "SOUL updated successfully" });
      } catch (e) {
        sendJson(res, 500, { error: "soul_update_failed", detail: String(e) });
      }
    });
    return;
  }

  if (req.method !== "POST" || req.url !== "/v1/chat") {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (bridgeToken) {
    const headerToken = String(req.headers["x-openclaw-token"] ?? "");
    if (headerToken !== bridgeToken) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
  }

  let size = 0;
  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > maxBody) {
      req.destroy(new Error("payload too large"));
      return;
    }
    raw += chunk;
  });
  req.on("error", () => {
    sendJson(res, 400, { error: "request_read_error" });
  });
  req.on("end", async () => {
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }
    const text = String(body.text ?? "").trim();
    if (!text) {
      sendJson(res, 400, { error: "text is required" });
      return;
    }
    const toAddress = sessionToAddress(body.session_id);
    try {
      const result = await runOpenClawAgent(text, toAddress);
      // actionsのバリデーションとフォールバック
      const VALID_ACTIONS = ["idle", "thinking", "speaking", "nod", "agree", "surprised", "emphasis", "joy", "anger", "melancholy", "fun"];
      let actions = ["speaking"]; // デフォルト

      if (result?.actions && Array.isArray(result.actions)) {
        const validActions = [];
        for (const a of result.actions) {
          if (typeof a === "string" && VALID_ACTIONS.includes(a.toLowerCase().trim())) {
            validActions.push(a.toLowerCase().trim());
          }
        }

        if (validActions.length > 0) {
          const last = validActions[validActions.length - 1];
          if (last === "speaking") {
            actions = validActions;
          } else {
            actions = [...validActions, "speaking"];
          }
        }
      }

      sendJson(res, 200, { text: result.text, actions });
    } catch (e) {
      sendJson(res, 502, { error: "openclaw_error", detail: String(e) });
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log("openclaw bridge listening on :" + port);
});
JS

cat > /etc/systemd/system/openclaw-bridge.service <<UNIT
[Unit]
Description=OpenClaw Bridge API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=OPENCLAW_PORT=\${OPENCLAW_PORT}
Environment=OPENCLAW_BRIDGE_TOKEN=\${OPENCLAW_BRIDGE_TOKEN}
ExecStart=/usr/bin/node /opt/openclaw-bridge/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable openclaw-bridge
systemctl restart openclaw-bridge
SCRIPT

if gcloud compute instance-templates describe "${TEMPLATE_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute instance-templates delete "${TEMPLATE_NAME}" --quiet --project "${PROJECT_ID}"
fi

gcloud compute instance-templates create "${TEMPLATE_NAME}" \
  --project "${PROJECT_ID}" \
  --machine-type "e2-standard-2" \
  --image-family "debian-12" \
  --image-project "debian-cloud" \
  --service-account "${VM_SERVICE_ACCOUNT}" \
  --scopes "https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/logging.write" \
  --tags "openclaw" \
  --metadata-from-file startup-script="${TMP_SCRIPT}"

rm -f "${TMP_SCRIPT}"

gcloud compute instance-templates describe "${TEMPLATE_NAME}" --project "${PROJECT_ID}" --format='value(selfLink)'
