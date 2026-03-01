/**
 * 音声録音フック
 * MediaRecorderを使用した録音機能
 */
import { useState, useRef, useCallback } from "react";

export interface AudioRecorderResult {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
}

export function useAudioRecorder(): AudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // refで最新の録音状態を追跡（stale closure防止）
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // ブラウザがMediaRecorderをサポートしているか確認
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("このブラウザは音声録音をサポートしていません");
      }

      // マイクへのアクセスを要求
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // STT用のサンプリングレート
        },
      });

      // MediaRecorderを作成
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // データが利用可能になったらチャンクを保存
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // 録音停止時の処理
      mediaRecorder.onstop = () => {
        // ストリームを停止（マイクのランプを消す）
        stream.getTracks().forEach((track) => track.stop());
      };

      // 録音開始
      mediaRecorder.start();
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "録音の開始に失敗しました";
      setError(message);
      isRecordingRef.current = false;
      setIsRecording(false);
      throw err;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecordingRef.current) {
        resolve(null);
        return;
      }

      const mediaRecorder = mediaRecorderRef.current;

      // onstopイベントでBlobを返す
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        chunksRef.current = [];
        isRecordingRef.current = false;
        setIsRecording(false);

        resolve(audioBlob);
      };

      // エラーハンドリング
      mediaRecorder.onerror = (event) => {
        setError("録音の停止中にエラーが発生しました");
        isRecordingRef.current = false;
        setIsRecording(false);
        reject(event);
      };

      // 録音停止
      try {
        mediaRecorder.stop();
      } catch (err) {
        setError("録音の停止に失敗しました");
        isRecordingRef.current = false;
        setIsRecording(false);
        reject(err);
      }
    });
  }, []); // 依存配列が空 → 安定したコールバック

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
  };
}
