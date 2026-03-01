import { randomUUID } from "node:crypto";
import type { ChatMessage } from "../types/api.js";

type SessionOwnerMap = Map<string, string>;
type SessionMessagesMap = Map<string, ChatMessage[]>;
export type PixelJobStatus = "queued" | "processing" | "completed" | "failed";

export interface PixelAssetUrls {
  base_fullbody_png?: string;
  motion_frame_urls?: Record<string, string[]>;
  motion_gif_urls?: Record<string, string>;
}

export interface PixelJob {
  id: string;
  userId: string;
  status: PixelJobStatus;
  createdAtMs: number;
  updatedAtMs: number;
  progress: number;
  pipelineVersion: string;
  assetUrls?: PixelAssetUrls;
  errorMessage?: string;
}

// ── Voice Clone Job ──
export type VoiceCloneJobStatus = "queued" | "processing" | "ready" | "failed";

export interface VoiceCloneJob {
  id: string;
  userId: string;
  status: VoiceCloneJobStatus;
  voiceProfileRef: string | null;
  errorMessage: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

// ── Audio Buffer（ユーザーレベル蓄積） ──
export interface AudioEntry {
  buffer: Buffer;
  mimeType: string;
}

// ── Onboarding Session ──
export interface OnboardingSession {
  id: string;
  userId: string;
  createdAtMs: number;
}

// ── User ──
export interface StoredUser {
  id: string;
  googleSub: string;
  email: string;
  name: string | null;
  createdAtMs: number;
}

class MemoryStore {
  private readonly sessionOwner: SessionOwnerMap = new Map();
  private readonly sessionMessages: SessionMessagesMap = new Map();
  private readonly pixelJobs: Map<string, PixelJob> = new Map();
  private readonly voiceCloneJobs: Map<string, VoiceCloneJob> = new Map();
  private readonly userAudioBuffers: Map<string, AudioEntry[]> = new Map();
  private readonly onboardingSessions: Map<string, OnboardingSession> = new Map();
  private readonly onboardingCompletedUsers: Set<string> = new Set();
  private readonly users: Map<string, StoredUser> = new Map();
  private readonly googleSubToUserId: Map<string, string> = new Map();

  issueSession(userId: string): string {
    const sessionId = `sess_${randomUUID()}`;
    this.sessionOwner.set(sessionId, userId);
    this.sessionMessages.set(sessionId, []);
    return sessionId;
  }

  ensureSessionOwnership(sessionId: string, userId: string): boolean {
    return this.sessionOwner.get(sessionId) === userId;
  }

  hasSession(sessionId: string): boolean {
    return this.sessionOwner.has(sessionId);
  }

  listOwnedSessions(userId: string): string[] {
    const result: string[] = [];
    for (const [sessionId, owner] of this.sessionOwner.entries()) {
      if (owner === userId) result.push(sessionId);
    }
    return result;
  }

  saveMessage(message: ChatMessage): void {
    const list = this.sessionMessages.get(message.session_id) ?? [];
    list.push(message);
    this.sessionMessages.set(message.session_id, list);
  }

  getMessages(sessionId: string): ChatMessage[] {
    return this.sessionMessages.get(sessionId) ?? [];
  }

  deleteMessage(sessionId: string, messageId: string): boolean {
    const list = this.sessionMessages.get(sessionId);
    if (!list) return false;

    const next = list.filter((m) => m.id !== messageId);
    const changed = next.length !== list.length;
    if (changed) {
      this.sessionMessages.set(sessionId, next);
    }
    return changed;
  }

  findMessageOwnerSession(userId: string, messageId: string): string | null {
    for (const sessionId of this.listOwnedSessions(userId)) {
      const found = (this.sessionMessages.get(sessionId) ?? []).some((m) => m.id === messageId);
      if (found) return sessionId;
    }
    return null;
  }

  createPixelJob(userId: string, jobId: string): void {
    this.pixelJobs.set(jobId, {
      id: jobId,
      userId,
      status: "queued",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      progress: 5,
      pipelineVersion: "nanobanana2-fullbody-v2",
    });
  }

  updatePixelJobProgress(userId: string, jobId: string, progress: number): void {
    const job = this.pixelJobs.get(jobId);
    if (!job || job.userId !== userId) return;
    job.status = "processing";
    job.progress = Math.max(0, Math.min(99, progress));
    job.updatedAtMs = Date.now();
    this.pixelJobs.set(jobId, job);
  }

  completePixelJob(userId: string, jobId: string, assetUrls: PixelAssetUrls): void {
    const job = this.pixelJobs.get(jobId);
    if (!job || job.userId !== userId) return;
    job.status = "completed";
    job.progress = 100;
    job.assetUrls = assetUrls;
    job.errorMessage = undefined;
    job.updatedAtMs = Date.now();
    this.pixelJobs.set(jobId, job);
  }

  failPixelJob(userId: string, jobId: string, message: string): void {
    const job = this.pixelJobs.get(jobId);
    if (!job || job.userId !== userId) return;
    job.status = "failed";
    job.errorMessage = message;
    job.updatedAtMs = Date.now();
    this.pixelJobs.set(jobId, job);
  }

  getPixelJob(userId: string, jobId: string): PixelJob | null {
    const job = this.pixelJobs.get(jobId);
    if (!job || job.userId !== userId) return null;
    return job;
  }

  getLatestPixelJobByUser(userId: string): PixelJob | null {
    let latest: PixelJob | null = null;
    for (const job of this.pixelJobs.values()) {
      if (job.userId === userId && (!latest || job.createdAtMs > latest.createdAtMs)) {
        latest = job;
      }
    }
    return latest;
  }

  // ── Voice Clone Job CRUD ──

  createVoiceCloneJob(userId: string, jobId: string): void {
    this.voiceCloneJobs.set(jobId, {
      id: jobId,
      userId,
      status: "queued",
      voiceProfileRef: null,
      errorMessage: null,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
  }

  updateVoiceCloneJobStatus(userId: string, jobId: string, status: VoiceCloneJobStatus): void {
    const job = this.voiceCloneJobs.get(jobId);
    if (!job || job.userId !== userId) return;
    job.status = status;
    job.updatedAtMs = Date.now();
  }

  completeVoiceCloneJob(userId: string, jobId: string, voiceProfileRef: string): void {
    const job = this.voiceCloneJobs.get(jobId);
    if (!job || job.userId !== userId) return;
    job.status = "ready";
    job.voiceProfileRef = voiceProfileRef;
    job.errorMessage = null;
    job.updatedAtMs = Date.now();
  }

  failVoiceCloneJob(userId: string, jobId: string, message: string): void {
    const job = this.voiceCloneJobs.get(jobId);
    if (!job || job.userId !== userId) return;
    job.status = "failed";
    job.errorMessage = message;
    job.updatedAtMs = Date.now();
  }

  getVoiceCloneJob(userId: string, jobId: string): VoiceCloneJob | null {
    const job = this.voiceCloneJobs.get(jobId);
    if (!job || job.userId !== userId) return null;
    return job;
  }

  getLatestVoiceCloneJobByUser(userId: string): VoiceCloneJob | null {
    let latest: VoiceCloneJob | null = null;
    for (const job of this.voiceCloneJobs.values()) {
      if (job.userId === userId && (!latest || job.createdAtMs > latest.createdAtMs)) {
        latest = job;
      }
    }
    return latest;
  }

  getUserVoiceProfileRef(userId: string): string | null {
    const job = this.getLatestVoiceCloneJobByUser(userId);
    return job?.status === "ready" ? job.voiceProfileRef : null;
  }

  // ── Audio Buffer（ユーザーレベル蓄積）──

  appendUserAudioBuffer(userId: string, buffer: Buffer, mimeType: string): number {
    const list = this.userAudioBuffers.get(userId) ?? [];
    list.push({ buffer, mimeType });
    this.userAudioBuffers.set(userId, list);
    return list.length;
  }

  getUserAudioBuffers(userId: string): AudioEntry[] {
    return this.userAudioBuffers.get(userId) ?? [];
  }

  clearUserAudioBuffers(userId: string): void {
    this.userAudioBuffers.delete(userId);
  }

  // ── Onboarding Session ──

  createOnboardingSession(userId: string, sessionId: string): void {
    this.onboardingSessions.set(sessionId, {
      id: sessionId,
      userId,
      createdAtMs: Date.now(),
    });
  }

  getOnboardingSession(userId: string, sessionId: string): OnboardingSession | null {
    const session = this.onboardingSessions.get(sessionId);
    if (!session || session.userId !== userId) return null;
    return session;
  }

  markOnboardingCompleted(userId: string): void {
    this.onboardingCompletedUsers.add(userId);
  }

  isOnboardingCompleted(userId: string): boolean {
    return this.onboardingCompletedUsers.has(userId);
  }

  // ── User ──

  createUser(userId: string, googleSub: string, email: string, name: string | null): StoredUser {
    const user: StoredUser = { id: userId, googleSub, email, name, createdAtMs: Date.now() };
    this.users.set(userId, user);
    this.googleSubToUserId.set(googleSub, userId);
    return user;
  }

  getUserByGoogleSub(googleSub: string): StoredUser | undefined {
    const userId = this.googleSubToUserId.get(googleSub);
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  getUser(userId: string): StoredUser | undefined {
    return this.users.get(userId);
  }
}

export const store = new MemoryStore();
