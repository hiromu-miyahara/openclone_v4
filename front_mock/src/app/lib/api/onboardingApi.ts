import { fetchApi, fetchUpload } from "./client";
import type {
  OnboardingStartResponse,
  OnboardingAnswerRequest,
  Big5AnswerRequest,
  Big5ResultResponse,
  PhotoUploadResponse,
  PixelartJobStatusResponse,
  VoiceCloneStartRequest,
  VoiceCloneStartResponse,
  VoiceCloneStatusResponse,
  OnboardingCompleteResponse,
  OnboardingCompleteRequest,
} from "./types";

export async function onboardingStart(): Promise<OnboardingStartResponse> {
  return fetchApi<OnboardingStartResponse>("/api/onboarding/start", { method: "POST" });
}

export async function uploadOnboardingAnswerAudio(audioFile: File): Promise<{ answer_audio_url: string }> {
  const formData = new FormData();
  formData.append("audio", audioFile);
  return fetchUpload<{ answer_audio_url: string }>("/api/onboarding/answer-audio-upload", formData);
}

export async function saveOnboardingAnswer(body: OnboardingAnswerRequest): Promise<{ saved: boolean }> {
  return fetchApi<{ saved: boolean }>("/api/onboarding/answers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function saveBig5Answer(body: Big5AnswerRequest): Promise<{ saved: boolean }> {
  return fetchApi<{ saved: boolean }>("/api/onboarding/big5-answers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getBig5Result(onboardingSessionId: string): Promise<Big5ResultResponse> {
  const qs = new URLSearchParams({ onboarding_session_id: onboardingSessionId });
  return fetchApi<Big5ResultResponse>(`/api/onboarding/big5-result?${qs.toString()}`);
}

export async function uploadPhoto(photoFile: File): Promise<PhotoUploadResponse> {
  const formData = new FormData();
  formData.append("photo", photoFile);
  return fetchUpload<PhotoUploadResponse>("/api/onboarding/photo-upload", formData);
}

export async function getPixelartStatus(jobId: string): Promise<PixelartJobStatusResponse> {
  return fetchApi<PixelartJobStatusResponse>(`/api/onboarding/pixelart-status/${jobId}`);
}

export async function startVoiceClone(body: VoiceCloneStartRequest): Promise<VoiceCloneStartResponse> {
  return fetchApi<VoiceCloneStartResponse>("/api/onboarding/voice-clone/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getVoiceCloneStatus(jobId: string): Promise<VoiceCloneStatusResponse> {
  return fetchApi<VoiceCloneStatusResponse>(`/api/onboarding/voice-clone-status/${jobId}`);
}

export async function completeOnboarding(body: OnboardingCompleteRequest): Promise<OnboardingCompleteResponse> {
  return fetchApi<OnboardingCompleteResponse>("/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
