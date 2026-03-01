/**
 * STT APIクライアント
 */
import { fetchUpload } from "./client";
import type { SttTranscribeResponse } from "./types";

/**
 * 音声をテキスト化（Voxtral）
 */
export async function transcribe(audioFile: File): Promise<SttTranscribeResponse> {
  const formData = new FormData();
  formData.append("audio", audioFile);

  return fetchUpload<SttTranscribeResponse>(
    "/api/stt/transcribe",
    formData
  );
}
