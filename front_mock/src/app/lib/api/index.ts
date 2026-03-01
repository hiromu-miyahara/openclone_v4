import { isApiMock } from "../utils/env";
import { authApi as realAuthApi } from "./client";
import { sendChat as realSendChat, getHistory as realGetHistory, searchHistory as realSearchHistory, deleteMessage as realDeleteMessage } from "./chatApi";
import { transcribe as realTranscribe } from "./sttApi";
import {
  onboardingStart as realOnboardingStart,
  uploadOnboardingAnswerAudio as realUploadOnboardingAnswerAudio,
  saveOnboardingAnswer as realSaveOnboardingAnswer,
  saveBig5Answer as realSaveBig5Answer,
  getBig5Result as realGetBig5Result,
  uploadPhoto as realUploadPhoto,
  getPixelartStatus as realGetPixelartStatus,
  startVoiceClone as realStartVoiceClone,
  getVoiceCloneStatus as realGetVoiceCloneStatus,
  completeOnboarding as realCompleteOnboarding,
} from "./onboardingApi";
import type {
  ChatSendRequest,
  ChatHistoryRequest,
  ChatHistoryResponse,
  ChatSearchRequest,
  ChatSearchResponse,
  SSEEvent,
  SttTranscribeResponse,
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

export type ApiMode = "real" | "mock";

function currentMode(): ApiMode {
  return isApiMock() ? "mock" : "real";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* mockSendChat(request: ChatSendRequest): AsyncGenerator<SSEEvent> {
  const answer = `モック応答: ${request.text}`;
  for (const chunk of answer.match(/.{1,10}/g) ?? [answer]) {
    await sleep(30);
    yield { type: "token", data: { text_chunk: chunk } };
  }
  yield {
    type: "final",
    data: {
      message_id: `msg_mock_${Date.now()}`,
      session_id: request.session_id ?? `sess_mock_${Date.now()}`,
      action: "speaking",
      tts_status: "skipped",
    },
  };
  yield { type: "done", data: {} };
}

const mockApi = {
  auth: {
    async login(_loginToken: string) {
      return {
        user: {
          id: `usr_mock_${Date.now()}`,
          auth_provider: "google" as const,
          created_at: new Date().toISOString(),
        },
        token: "mock-token",
        expires_in: 86400,
      };
    },
    async logout(): Promise<void> {
      return undefined;
    },
    async me() {
      return {
        user: {
          id: "usr_mock",
          auth_provider: "google" as const,
          created_at: new Date().toISOString(),
        },
      };
    },
  },
  chat: {
    send: mockSendChat,
    async history(_req: ChatHistoryRequest): Promise<ChatHistoryResponse> {
      return { messages: [], total: 0 };
    },
    async search(_req: ChatSearchRequest): Promise<ChatSearchResponse> {
      return { results: [], total: 0 };
    },
    async delete(_messageId: string): Promise<void> {
      return undefined;
    },
  },
  stt: {
    async transcribe(_audioFile: File): Promise<SttTranscribeResponse> {
      return { transcript: "モック文字起こしです" };
    },
  },
  onboarding: {
    async start() {
      return { onboarding_session_id: `onb_mock_${Date.now()}` };
    },
    async uploadAnswerAudio(_audioFile: File) {
      return { answer_audio_url: `https://mock.local/audio/${Date.now()}.webm` };
    },
    async saveAnswer(_body: OnboardingAnswerRequest) {
      return { saved: true };
    },
    // モック用Big5回答保存先
    _mockBig5Answers: [] as Array<{ question_id: number; choice_value: number }>,
    async saveBig5Answer(body: Big5AnswerRequest) {
      // モック用に回答を保存
      mockApi._mockBig5Answers = body.answers;
      return { saved: true };
    },
    async getBig5Result(onboardingSessionId: string): Promise<Big5ResultResponse> {
      // 回答がなければデフォルト値
      const answers = mockApi._mockBig5Answers.length > 0
        ? mockApi._mockBig5Answers
        : [
            { question_id: 1, choice_value: 5 },
            { question_id: 2, choice_value: 5 },
            { question_id: 3, choice_value: 5 },
            { question_id: 4, choice_value: 5 },
            { question_id: 5, choice_value: 5 },
            { question_id: 6, choice_value: 5 },
            { question_id: 7, choice_value: 5 },
            { question_id: 8, choice_value: 5 },
            { question_id: 9, choice_value: 5 },
            { question_id: 10, choice_value: 5 },
          ];

      // 回答をマップ化
      const answerMap = new Map(answers.map(a => [a.question_id, a.choice_value]));

      // 逆転項目関数
      const reverse = (v: number) => 8 - v;

      // Big5素点計算
      const q1 = answerMap.get(1) ?? 4;
      const q2 = answerMap.get(2) ?? 4;
      const q3 = answerMap.get(3) ?? 4;
      const q4 = answerMap.get(4) ?? 4;
      const q5 = answerMap.get(5) ?? 4;
      const q6 = answerMap.get(6) ?? 4;
      const q7 = answerMap.get(7) ?? 4;
      const q8 = answerMap.get(8) ?? 4;
      const q9 = answerMap.get(9) ?? 4;
      const q10 = answerMap.get(10) ?? 4;

      const E_raw = (q1 + reverse(q6)) / 2;
      const A_raw = (reverse(q2) + q7) / 2;
      const C_raw = (q3 + reverse(q8)) / 2;
      const N_raw = (q4 + reverse(q9)) / 2;
      const O_raw = (q5 + reverse(q10)) / 2;

      // 正規化 (0-1)
      const E = (E_raw - 1) / 6;
      const A = (A_raw - 1) / 6;
      const C = (C_raw - 1) / 6;
      const N = (N_raw - 1) / 6;
      const O = (O_raw - 1) / 6;

      // トーン計算
      const formality = 0.4 * C + 0.3 * (1 - E) + 0.3 * (1 - O);
      const energy = 0.4 * E + 0.3 * O + 0.2 * (1 - N) + 0.1 * A;
      const directness = 0.4 * (1 - A) + 0.3 * C + 0.2 * E + 0.1 * (1 - N);
      const warmth = 0.5 * A + 0.2 * E + 0.2 * (1 - N) + 0.1 * O;

      // タイプ判定
      let type_code: "leader" | "supporter" | "creator" | "analyst" | "communicator" | "balanced" = "balanced";
      if (E >= 0.6 && C >= 0.6) type_code = "leader";
      else if (A >= 0.6 && N <= 0.4) type_code = "supporter";
      else if (O >= 0.6 && E >= 0.5) type_code = "creator";
      else if (C >= 0.6 && O >= 0.5) type_code = "analyst";
      else if (E >= 0.6 && A >= 0.5) type_code = "communicator";

      const typeLabels = {
        leader: "リーダー型",
        supporter: "サポート型",
        creator: "クリエイター型",
        analyst: "アナリスト型",
        communicator: "コミュニケーター型",
        balanced: "バランス型",
      };

      return {
        onboarding_session_id: onboardingSessionId,
        scores_raw: {
          openness: O_raw,
          conscientiousness: C_raw,
          extraversion: E_raw,
          agreeableness: A_raw,
          neuroticism: N_raw,
        },
        scores: {
          openness: O,
          conscientiousness: C,
          extraversion: E,
          agreeableness: A,
          neuroticism: N,
        },
        tone: {
          formality: Math.max(0, Math.min(1, formality)),
          energy: Math.max(0, Math.min(1, energy)),
          directness: Math.max(0, Math.min(1, directness)),
          warmth: Math.max(0, Math.min(1, warmth)),
        },
        type_code,
        type_label: typeLabels[type_code],
      };
    },
    async uploadPhoto(_photoFile: File): Promise<PhotoUploadResponse> {
      return {
        job_id: `job_mock_${Date.now()}`,
        status: "processing",
        pipeline_version: "nanobanana2-fullbody-v2",
      };
    },
    async getPixelartStatus(_jobId: string): Promise<PixelartJobStatusResponse> {
      return {
        status: "completed",
        progress: 100,
        pipeline_version: "nanobanana2-fullbody-v2",
        asset_urls: {
          base_fullbody_png: "/mock/base_fullbody.png",
          motion_frame_urls: {
            walk_wander: [
              "/mock/walk_wander_0001.png",
              "/mock/walk_wander_0002.png",
              "/mock/walk_wander_0003.png",
              "/mock/walk_wander_0004.png",
              "/mock/walk_wander_0005.png",
              "/mock/walk_wander_0006.png",
            ],
            speaking: [
              "/mock/speaking_0001.png",
              "/mock/speaking_0002.png",
              "/mock/speaking_0003.png",
              "/mock/speaking_0004.png",
              "/mock/speaking_0005.png",
              "/mock/speaking_0006.png",
            ],
            thinking: [
              "/mock/thinking_0001.png",
              "/mock/thinking_0002.png",
              "/mock/thinking_0003.png",
              "/mock/thinking_0004.png",
            ],
            joy: [
              "/mock/joy_0001.png",
              "/mock/joy_0002.png",
              "/mock/joy_0003.png",
              "/mock/joy_0004.png",
            ],
            futon_sleep: [
              "/mock/futon_sleep_0001.png",
              "/mock/futon_sleep_0002.png",
              "/mock/futon_sleep_0003.png",
              "/mock/futon_sleep_0004.png",
            ],
            futon_out: [
              "/mock/futon_out_0001.png",
              "/mock/futon_out_0002.png",
              "/mock/futon_out_0003.png",
              "/mock/futon_out_0004.png",
              "/mock/futon_out_0005.png",
            ],
            anger: [
              "/mock/anger_0001.png",
              "/mock/anger_0002.png",
              "/mock/anger_0003.png",
              "/mock/anger_0004.png",
            ],
            melancholy: [
              "/mock/melancholy_0001.png",
              "/mock/melancholy_0002.png",
              "/mock/melancholy_0003.png",
              "/mock/melancholy_0004.png",
            ],
            fun: [
              "/mock/fun_0001.png",
              "/mock/fun_0002.png",
              "/mock/fun_0003.png",
              "/mock/fun_0004.png",
            ],
            surprise: [
              "/mock/surprise_0001.png",
              "/mock/surprise_0002.png",
              "/mock/surprise_0003.png",
              "/mock/surprise_0004.png",
            ],
            study_note: [
              "/mock/study_note_0001.png",
              "/mock/study_note_0002.png",
              "/mock/study_note_0003.png",
              "/mock/study_note_0004.png",
              "/mock/study_note_0005.png",
            ],
          },
          motion_gif_urls: {
            walk_wander: "/mock/walk_wander.gif",
            speaking: "/mock/speaking.gif",
            thinking: "/mock/thinking.gif",
            joy: "/mock/joy.gif",
            futon_sleep: "/mock/futon_sleep.gif",
            futon_out: "/mock/futon_out.gif",
            anger: "/mock/anger.gif",
            melancholy: "/mock/melancholy.gif",
            fun: "/mock/fun.gif",
            surprise: "/mock/surprise.gif",
            study_note: "/mock/study_note.gif",
          },
        },
      };
    },
    async startVoiceClone(_body: VoiceCloneStartRequest): Promise<VoiceCloneStartResponse> {
      return {
        job_id: `vcj_mock_${Date.now()}`,
        status: "processing",
      };
    },
    async getVoiceCloneStatus(jobId: string): Promise<VoiceCloneStatusResponse> {
      return {
        job_id: jobId,
        status: "ready",
        voice_profile_ref: "voice_mock_ref",
      };
    },
    async complete(body: OnboardingCompleteRequest): Promise<OnboardingCompleteResponse> {
      return { persona_profile_id: `persona_mock_${body.onboarding_session_id}` };
    },
  },
};

const realApi = {
  auth: realAuthApi,
  chat: {
    send: realSendChat,
    history: realGetHistory,
    search: realSearchHistory,
    delete: realDeleteMessage,
  },
  stt: {
    transcribe: realTranscribe,
  },
  onboarding: {
    start: realOnboardingStart,
    uploadAnswerAudio: realUploadOnboardingAnswerAudio,
    saveAnswer: realSaveOnboardingAnswer,
    saveBig5Answer: realSaveBig5Answer,
    getBig5Result: realGetBig5Result,
    uploadPhoto: realUploadPhoto,
    getPixelartStatus: realGetPixelartStatus,
    startVoiceClone: realStartVoiceClone,
    getVoiceCloneStatus: realGetVoiceCloneStatus,
    complete: realCompleteOnboarding,
  },
};

export function getApiMode(): ApiMode {
  return currentMode();
}

export const api = currentMode() === "mock" ? mockApi : realApi;
