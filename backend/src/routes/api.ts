import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { HttpError } from "../lib/http.js";
import { signAccessToken } from "../lib/auth.js";
import { generateReplyFromOpenClaw } from "../lib/openclaw.js";
import { ensureUserProvisioning, getUserOpenClawConnection, getUserOpenClawState } from "../lib/openclawProvisioner.js";
import { transcribeWithVoxtral } from "../lib/voxtral.js";
import { synthesizeWithElevenLabs } from "../lib/elevenlabs.js";
import { store } from "../lib/store.js";
import { startFullbodyMotionGenerationJob } from "../lib/pixelGenerator.js";
import { calculateBig5Result, getTypeLabel, type Big5Answer } from "../lib/big5Calculator.js";
import { updateOpenClawSoul } from "../lib/openclawSoulUpdater.js";
import { startVoiceCloneJob } from "../lib/voiceCloner.js";
import { verifyGoogleAccessToken } from "../lib/googleAuth.js";
import { requireAuth } from "../middleware/auth.js";
import { makeRateLimiter } from "../middleware/rateLimit.js";
import type { ChatMessage } from "../types/api.js";

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const chatRateLimit = makeRateLimiter("chat", 20, 60_000);
const sttRateLimit = makeRateLimiter("stt", 10, 60_000);
const authRateLimit = makeRateLimiter("auth", 20, 60_000);
const bootstrapAuthToken = process.env.BOOTSTRAP_AUTH_TOKEN ?? "";
const userChatInFlight = new Set<string>();

function assertAllowedMime(actual: string, allowed: string[], label: string): void {
  if (!allowed.includes(actual)) {
    throw new HttpError(400, "validation_error", `${label}の形式が不正です`);
  }
}

function assertBootstrapAuth(req: import("express").Request): void {
  if (!bootstrapAuthToken) {
    throw new HttpError(500, "internal_error", "BOOTSTRAP_AUTH_TOKEN が未設定です");
  }
  const header = String(req.header("x-openclone-bootstrap-token") ?? "");
  if (!header || header !== bootstrapAuthToken) {
    throw new HttpError(401, "unauthorized", "bootstrap token が不正です");
  }
}

function startsWithBytes(buf: Buffer, prefix: number[]): boolean {
  if (buf.length < prefix.length) return false;
  return prefix.every((v, i) => buf[i] === v);
}

function assertFileSignature(file: Express.Multer.File, label: "audio" | "photo"): void {
  if (label === "photo") {
    const okJpeg = startsWithBytes(file.buffer, [0xff, 0xd8, 0xff]);
    const okPng = startsWithBytes(file.buffer, [0x89, 0x50, 0x4e, 0x47]);
    const okWebp = file.buffer.length >= 12 && file.buffer.subarray(0, 4).toString("ascii") === "RIFF" && file.buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!okJpeg && !okPng && !okWebp) {
      throw new HttpError(400, "validation_error", "photo のファイル内容が不正です");
    }
    return;
  }

  const okWav = file.buffer.length >= 12 && file.buffer.subarray(0, 4).toString("ascii") === "RIFF" && file.buffer.subarray(8, 12).toString("ascii") === "WAVE";
  const okMp3 = startsWithBytes(file.buffer, [0x49, 0x44, 0x33]) || startsWithBytes(file.buffer, [0xff, 0xfb]);
  const okOgg = startsWithBytes(file.buffer, [0x4f, 0x67, 0x67, 0x53]);
  const okMp4Like = file.buffer.length >= 12 && file.buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (!okWav && !okMp3 && !okOgg && !okMp4Like) {
    throw new HttpError(400, "validation_error", "audio のファイル内容が不正です");
  }
}

function parsePaging(limitRaw: unknown, offsetRaw: unknown, defaultLimit: number): { limit: number; offset: number } {
  const limit = Number.parseInt(String(limitRaw ?? defaultLimit), 10);
  const offset = Number.parseInt(String(offsetRaw ?? 0), 10);

  if (Number.isNaN(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, "validation_error", "limit は 1..100 で指定してください");
  }
  if (Number.isNaN(offset) || offset < 0) {
    throw new HttpError(400, "validation_error", "offset は 0 以上で指定してください");
  }

  return { limit, offset };
}

function ensureSession(sessionId: string | undefined, userId: string): string {
  if (!sessionId) {
    return store.issueSession(userId);
  }
  if (!store.hasSession(sessionId)) {
    throw new HttpError(404, "resource_not_found", "session が存在しません");
  }
  if (!store.ensureSessionOwnership(sessionId, userId)) {
    throw new HttpError(403, "forbidden", "他ユーザーの session にはアクセスできません");
  }
  return sessionId;
}

function writeSse(res: import("express").Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export const apiRouter = Router();

// auth
apiRouter.post("/auth/login", authRateLimit, async (req, res, next) => {
  try {
    const loginToken = String((req.body as { login_token?: string } | undefined)?.login_token ?? "").trim();
    if (!loginToken) {
      throw new HttpError(400, "validation_error", "login_token が必要です");
    }

    // Google access_token を検証してユーザー情報を取得
    const googleUser = await verifyGoogleAccessToken(loginToken);

    // 既存ユーザー検索 or 新規作成
    const existing = store.getUserByGoogleSub(googleUser.sub);
    let userId: string;
    let isNew = false;
    if (existing) {
      userId = existing.id;
    } else {
      userId = `usr_${randomUUID()}`;
      store.createUser(userId, googleUser.sub, googleUser.email, googleUser.name);
      isNew = true;
    }

    // 新規ユーザーの場合のみプロビジョニング開始
    const provision = isNew
      ? ensureUserProvisioning(userId)
      : (await getUserOpenClawState(userId)) ?? ensureUserProvisioning(userId);

    const token = await signAccessToken(userId);
    res.json({
      user: {
        id: userId,
        auth_provider: "google",
        created_at: existing
          ? new Date(existing.createdAtMs).toISOString()
          : new Date().toISOString(),
      },
      token,
      expires_in: 86_400,
      openclaw: {
        status: provision.status,
        instance_name: provision.instanceName,
      },
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post("/auth/logout", requireAuth, (_req, res) => {
  res.status(204).end();
});

apiRouter.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const provision = await getUserOpenClawState(userId);
    res.json({
      user: {
        id: userId,
        auth_provider: "google",
        created_at: new Date().toISOString(),
      },
      onboarding_completed: store.isOnboardingCompleted(userId),
      openclaw: provision
        ? {
            status: provision.status,
            instance_name: provision.instanceName,
            endpoint: provision.endpoint,
            updated_at: provision.updatedAt,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/auth/provisioning-status", requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const state = (await getUserOpenClawState(userId)) ?? ensureUserProvisioning(userId);
    res.json({
      status: state.status,
      instance_name: state.instanceName,
      endpoint: state.endpoint,
      last_error: state.lastError,
      updated_at: state.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

// onboarding
apiRouter.post("/onboarding/start", requireAuth, (req, res) => {
  const userId = req.userId!;
  const sessionId = `onb_${randomUUID()}`;
  store.createOnboardingSession(userId, sessionId);
  res.json({ onboarding_session_id: sessionId });
});

apiRouter.post("/onboarding/answer-audio-upload", requireAuth, uploadAudio.single("audio"), (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "validation_error", "audio が必要です");
  }
  assertAllowedMime(req.file.mimetype, ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg"], "audio");
  assertFileSignature(req.file, "audio");
  const userId = req.userId!;
  const count = store.appendUserAudioBuffer(userId, req.file.buffer, req.file.mimetype);
  res.json({ answer_audio_url: `memory://${userId}/scene_${count}`, scene_index: count });
});

apiRouter.post("/onboarding/answers", requireAuth, (req, res) => {
  const { onboarding_session_id, question_id, answer_audio_url } = req.body as Record<string, unknown>;
  if (!onboarding_session_id || !question_id || !answer_audio_url) {
    throw new HttpError(400, "validation_error", "必須項目が不足しています");
  }
  res.json({ saved: true });
});

apiRouter.post("/onboarding/photo-upload", requireAuth, uploadPhoto.single("photo"), (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "validation_error", "photo が必要です");
  }
  assertAllowedMime(req.file.mimetype, ["image/jpeg", "image/png", "image/webp"], "photo");
  assertFileSignature(req.file, "photo");
  const userId = req.userId!;
  const jobId = `job_${randomUUID()}`;
  store.createPixelJob(userId, jobId);
  startFullbodyMotionGenerationJob({
    userId,
    jobId,
    photoBuffer: req.file.buffer,
    mimeType: req.file.mimetype,
  });
  res.json({
    job_id: jobId,
    status: "queued",
    pipeline_version: "nanobanana2-fullbody-v2",
  });
});

apiRouter.get("/onboarding/pixelart-status/:job_id", requireAuth, (req, res) => {
  if (!req.params.job_id) {
    throw new HttpError(404, "resource_not_found", "job_id が見つかりません");
  }
  const userId = req.userId!;
  const job = store.getPixelJob(userId, req.params.job_id);
  if (!job) {
    throw new HttpError(404, "resource_not_found", "job_id が見つかりません");
  }

  const body: Record<string, unknown> = {
    status: job.status,
    progress: job.progress,
    pipeline_version: job.pipelineVersion,
  };
  if (job.status === "completed") {
    body.asset_urls = job.assetUrls ?? {};
  }
  if (job.status === "failed") {
    body.error_message = job.errorMessage ?? "pixel generation failed";
  }
  res.json(body);
});

// Voice Clone
apiRouter.post("/onboarding/voice-clone/start", requireAuth, async (req, res, next) => {
  try {
    const { onboarding_session_id } = req.body as { onboarding_session_id?: string };
    if (!onboarding_session_id) {
      throw new HttpError(400, "validation_error", "onboarding_session_id が必要です");
    }
    const userId = req.userId!;
    const session = store.getOnboardingSession(userId, onboarding_session_id);
    if (!session) {
      throw new HttpError(404, "resource_not_found", "onboarding session が見つかりません");
    }
    const audioBuffers = store.getUserAudioBuffers(userId);
    if (audioBuffers.length === 0) {
      throw new HttpError(400, "validation_error", "音声ファイルがアップロードされていません");
    }
    const jobId = `vcj_${randomUUID()}`;
    store.createVoiceCloneJob(userId, jobId);
    startVoiceCloneJob({ userId, jobId, audioBuffers });
    res.json({ job_id: jobId, status: "queued" as const });
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/onboarding/voice-clone-status/:job_id", requireAuth, (req, res) => {
  const userId = req.userId!;
  const job = store.getVoiceCloneJob(userId, req.params.job_id);
  if (!job) {
    throw new HttpError(404, "resource_not_found", "voice clone job が見つかりません");
  }
  res.json({
    job_id: job.id,
    status: job.status,
    voice_profile_ref: job.voiceProfileRef,
    error_message: job.errorMessage,
  });
});

// Onboarding Complete（3条件ゲート）
apiRouter.post("/onboarding/complete", requireAuth, async (req, res, next) => {
  try {
    const { onboarding_session_id, big5_answers } = req.body as {
      onboarding_session_id?: string;
      big5_answers?: Big5Answer[];
    };
    if (!onboarding_session_id) {
      throw new HttpError(400, "validation_error", "onboarding_session_id が必要です");
    }
    if (!big5_answers || !Array.isArray(big5_answers) || big5_answers.length !== 10) {
      throw new HttpError(400, "validation_error", "big5_answers（10問分）が必要です");
    }

    const userId = req.userId!;

    // Gate 1: Voice Clone ready チェック
    const vcJob = store.getLatestVoiceCloneJobByUser(userId);
    if (!vcJob || vcJob.status !== "ready") {
      throw new HttpError(400, "validation_error", "Voice Clone が完了していません");
    }

    // Gate 2: Pixel Art completed チェック
    const pxJob = store.getLatestPixelJobByUser(userId);
    if (!pxJob || pxJob.status !== "completed") {
      throw new HttpError(400, "validation_error", "ピクセルアート生成が完了していません");
    }

    // Gate 3: OpenClaw ready チェック
    const openClaw = await getUserOpenClawConnection(userId);
    if (!openClaw) {
      throw new HttpError(400, "validation_error", "OpenClaw インスタンスが準備されていません");
    }

    // Big5計算 + SOUL更新
    const big5Result = calculateBig5Result(big5_answers);
    const personaProfileId = `persona_${randomUUID()}`;

    await updateOpenClawSoul(userId, big5Result, openClaw.endpoint, openClaw.authToken);
    store.markOnboardingCompleted(userId);

    res.json({
      persona_profile_id: personaProfileId,
      big5: {
        scores: big5Result.scores,
        tone: big5Result.tone,
        type_code: big5Result.typeCode,
        type_label: getTypeLabel(big5Result.typeCode),
      },
    });
  } catch (err) {
    next(err);
  }
});

// stt
apiRouter.post("/stt/transcribe", requireAuth, sttRateLimit, uploadAudio.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "validation_error", "audio が必要です");
    }
    assertAllowedMime(req.file.mimetype, ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg"], "audio");
    assertFileSignature(req.file, "audio");
    const transcript = await transcribeWithVoxtral(req.file);
    res.json({ transcript });
  } catch (err) {
    next(err);
  }
});

// chat send SSE
apiRouter.post("/chat/send", requireAuth, chatRateLimit, async (req, res, next) => {
  let lockAcquired = false;
  let lockUserId: string | null = null;
  try {
    const { text, session_id } = req.body as { text?: string; session_id?: string };
    if (!text || !text.trim()) {
      throw new HttpError(400, "validation_error", "text が必要です");
    }

    const userId = req.userId!;
    if (userChatInFlight.has(userId)) {
      throw new HttpError(429, "rate_limited", "前の応答生成が完了するまで待ってください");
    }
    userChatInFlight.add(userId);
    lockAcquired = true;
    lockUserId = userId;

    const sessionId = ensureSession(session_id, userId);

    const userMessage: ChatMessage = {
      id: `msg_${randomUUID()}`,
      session_id: sessionId,
      role: "user",
      text,
      actions: ["speaking"],
      audio_url: null,
      tts_status: "skipped",
      created_at: new Date().toISOString(),
    };
    store.saveMessage(userMessage);

    const openClaw = await getUserOpenClawConnection(userId);
    if (!openClaw) {
      const state = await getUserOpenClawState(userId);
      const status = state?.status ?? "pending";
      const detail = state?.lastError ?? "ユーザー専用OpenClawインスタンスの準備が完了していません";
      throw new HttpError(503, "internal_error", `OpenClaw未準備 status=${status}: ${detail}`);
    }

    const assistant = await generateReplyFromOpenClaw({
      text,
      sessionId,
      userId,
      baseUrlOverride: openClaw.endpoint,
      authToken: openClaw.authToken,
    });
    const userVoiceId = store.getUserVoiceProfileRef(userId) ?? undefined;
    const tts = await synthesizeWithElevenLabs(assistant.text, userVoiceId);
    const assistantMessage: ChatMessage = {
      id: `msg_${randomUUID()}`,
      session_id: sessionId,
      role: "assistant",
      text: assistant.text,
      actions: assistant.actions,
      audio_url: tts.audioUrl,
      tts_status: tts.ttsStatus,
      created_at: new Date().toISOString(),
    };
    store.saveMessage(assistantMessage);

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    for (const chunk of assistant.text.match(/.{1,12}/g) ?? [assistant.text]) {
      writeSse(res, "token", { text_chunk: chunk });
    }

    writeSse(res, "final", {
      message_id: assistantMessage.id,
      session_id: sessionId,
      actions: assistantMessage.actions,
      audio_url: assistantMessage.audio_url,
      tts_status: assistantMessage.tts_status,
    });

    writeSse(res, "done", {});
    res.end();
  } catch (err) {
    next(err);
  } finally {
    if (lockAcquired && lockUserId) {
      userChatInFlight.delete(lockUserId);
    }
  }
});

// history
apiRouter.get("/chat/history", requireAuth, (req, res) => {
  const userId = req.userId!;
  const sessionId = ensureSession(req.query.session_id as string | undefined, userId);
  const { limit, offset } = parsePaging(req.query.limit, req.query.offset, 50);
  const all = store.getMessages(sessionId);
  const paged = all.slice(offset, offset + limit);
  res.json({ messages: paged, total: all.length });
});

apiRouter.get("/chat/history/search", requireAuth, (req, res) => {
  const userId = req.userId!;
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    throw new HttpError(400, "validation_error", "q が必要です");
  }
  if (q.length > 200) {
    throw new HttpError(400, "validation_error", "q は 200 文字以内で指定してください");
  }
  const sessionId = ensureSession(req.query.session_id as string | undefined, userId);
  const { limit, offset } = parsePaging(req.query.limit, req.query.offset, 20);

  const resultsAll = store
    .getMessages(sessionId)
    .filter((m) => m.text.toLowerCase().includes(q.toLowerCase()));
  const results = resultsAll.slice(offset, offset + limit);

  res.json({ results, total: resultsAll.length });
});

// delete chat log
apiRouter.delete("/data/chat-logs/:message_id", requireAuth, (req, res) => {
  const userId = req.userId!;
  const messageId = req.params.message_id;

  const ownerSession = store.findMessageOwnerSession(userId, messageId);
  if (!ownerSession) {
    throw new HttpError(404, "resource_not_found", "message が見つかりません");
  }

  const deleted = store.deleteMessage(ownerSession, messageId);
  if (!deleted) {
    throw new HttpError(404, "resource_not_found", "message が見つかりません");
  }

  res.status(204).end();
});
