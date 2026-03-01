import { useEffect, useState, useMemo, useRef } from "react";
import type { PixelartAssetUrls } from "../../lib/api/types";
import { actionToMotion } from "../../lib/motionMap";

interface PixelAvatarProps {
  /** アクション名（ActionTypeまたはMotionName） */
  action?: string;
  /** localStorageから取得したアセットURL */
  assetUrls: PixelartAssetUrls | null;
}

/**
 * localStorageからピクセルアートアセットURLを取得するユーティリティ
 */
export function loadPixelAssets(): PixelartAssetUrls | null {
  const raw = localStorage.getItem("pixel_asset_urls");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PixelartAssetUrls;
  } catch {
    return null;
  }
}

/**
 * 全モーションのフレーム画像をプリロードするユーティリティ
 */
export function preloadPixelAssets(assetUrls: PixelartAssetUrls): void {
  if (!assetUrls.motion_frame_urls) return;
  for (const frames of Object.values(assetUrls.motion_frame_urls)) {
    for (const url of frames) {
      const img = new Image();
      img.src = url;
    }
  }
  // GIFもプリロード
  if (assetUrls.motion_gif_urls) {
    for (const url of Object.values(assetUrls.motion_gif_urls)) {
      const img = new Image();
      img.src = url;
    }
  }
  // ベース画像もプリロード
  if (assetUrls.base_fullbody_png) {
    const img = new Image();
    img.src = assetUrls.base_fullbody_png;
  }
}

/**
 * ピクセルアバターコンポーネント
 *
 * オンボーディングで生成されたピクセルアートをフレーム単位でアニメーション表示します。
 */
export function PixelAvatar({ action = "idle", assetUrls }: PixelAvatarProps) {
  const motionName = actionToMotion(action);
  const [frameIndex, setFrameIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 現在のモーションのフレームURL配列を取得
  const frames = useMemo(() => {
    if (!assetUrls?.motion_frame_urls) return [];
    return assetUrls.motion_frame_urls[motionName] ?? [];
  }, [assetUrls, motionName]);

  // GIFフォールバックURL
  const gifUrl = useMemo(() => {
    if (!assetUrls?.motion_gif_urls) return null;
    return assetUrls.motion_gif_urls[motionName] ?? null;
  }, [assetUrls, motionName]);

  // モーション変更時にフレームをリセット
  useEffect(() => {
    setFrameIndex(0);
  }, [motionName]);

  // 0.5秒間隔でフレーム送り
  useEffect(() => {
    if (frames.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [frames.length, motionName]); // motionNameが変わったら再設定

  // アセット未取得時はローディング表示
  if (!assetUrls) {
    return (
      <div className="w-[36rem] h-[54rem] max-w-full max-h-[60vh] flex items-center justify-center">
        <div className="w-16 h-16 border-2 border-[#6a5c3e] rounded animate-pulse bg-[#0e0e24]" />
      </div>
    );
  }

  // フレームが存在する場合はPNG切り替え
  if (frames.length > 0) {
    const currentFrameUrl = frames[frameIndex % frames.length];
    return (
      <div className="flex flex-col justify-center items-center">
        <img
          src={currentFrameUrl}
          alt={`${motionName} frame ${frameIndex}`}
          className="w-[36rem] h-[54rem] max-w-full max-h-[60vh] object-contain image-rendering-pixelated"
          draggable={false}
        />
      </div>
    );
  }

  // フレームがない場合はGIFフォールバック
  if (gifUrl) {
    return (
      <div className="flex flex-col justify-center items-center">
        <img
          src={gifUrl}
          alt={motionName}
          className="w-[36rem] h-[54rem] max-w-full max-h-[60vh] object-contain image-rendering-pixelated"
          draggable={false}
        />
      </div>
    );
  }

  // 何もない場合はベース画像
  if (assetUrls.base_fullbody_png) {
    return (
      <div className="flex flex-col justify-center items-center">
        <img
          src={assetUrls.base_fullbody_png}
          alt="avatar base"
          className="w-[36rem] h-[54rem] max-w-full max-h-[60vh] object-contain image-rendering-pixelated"
          draggable={false}
        />
      </div>
    );
  }

  // 完全にアセットがない場合のフォールバック
  return (
    <div className="w-[36rem] h-[54rem] max-w-full max-h-[60vh] flex items-center justify-center text-[#9a9080] text-xs">
      アバター準備中
    </div>
  );
}
