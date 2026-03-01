/**
 * Voice Cloneバックグラウンドジョブ
 * pixelGenerator.ts の startFullbodyMotionGenerationJob パターンを踏襲
 */
import { store, type AudioEntry } from "./store.js";
import { cloneVoiceWithElevenLabs } from "./elevenlabs.js";

function mimeExtension(mime: string): string {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  return "webm";
}

export function startVoiceCloneJob(params: {
  userId: string;
  jobId: string;
  audioBuffers: AudioEntry[];
}): void {
  void (async () => {
    const { userId, jobId, audioBuffers } = params;
    try {
      store.updateVoiceCloneJobStatus(userId, jobId, "processing");

      const files = audioBuffers.map((entry, i) => ({
        buffer: entry.buffer,
        mimeType: entry.mimeType,
        filename: `scene_${i + 1}.${mimeExtension(entry.mimeType)}`,
      }));

      const result = await cloneVoiceWithElevenLabs(files, `openclone-${userId.slice(0, 12)}`);

      if (result.status === "ready" && result.voiceId) {
        store.completeVoiceCloneJob(userId, jobId, result.voiceId);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ event: "voice_clone_completed", user_id: userId, voice_id: result.voiceId }));
      } else {
        store.failVoiceCloneJob(userId, jobId, result.errorMessage ?? "Voice Clone failed");
      }

      // メモリ上の音声バッファを解放
      store.clearUserAudioBuffers(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      store.failVoiceCloneJob(userId, jobId, message);
    }
  })();
}
