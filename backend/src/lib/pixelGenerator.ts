import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { store } from "./store.js";

const sleep = promisify(setTimeout);

type MotionPlan = {
  motion: string;
  frames: number;
};

const MOTION_PLAN: MotionPlan[] = [
  { motion: "futon_sleep", frames: 4 },
  { motion: "futon_out", frames: 5 },
  { motion: "speaking", frames: 6 },
  { motion: "joy", frames: 4 },
  { motion: "anger", frames: 4 },
  { motion: "melancholy", frames: 4 },
  { motion: "fun", frames: 4 },
  { motion: "surprise", frames: 4 },
  { motion: "study_note", frames: 5 },
  { motion: "walk_wander", frames: 6 },
  { motion: "thinking", frames: 4 },
];

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(process.cwd(), "../..")];
  for (const c of candidates) {
    const scriptPath = path.join(c, "experiments/pixel_face_lab/generate_fullbody_motion_gifs.py");
    if (fs.existsSync(scriptPath)) return c;
  }
  throw new Error("リポジトリルートを解決できませんでした");
}

function photoExtensionFromMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function runCommand(repoRoot: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cp = spawn("python3", args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    cp.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    cp.on("error", reject);
    cp.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`python3 exit=${code} ${stderr.slice(0, 1000)}`));
    });
  });
}

async function runCommandWithRetry(repoRoot: string, args: string[], retries: number): Promise<void> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      await runCommand(repoRoot, args);
      return;
    } catch (err) {
      attempt += 1;
      if (attempt > retries) throw err;
      await sleep(60_000);
    }
  }
}

/**
 * 並列数制御付きでタスクを実行する
 * @param tasks 実行するタスクの配列
 * @param concurrency 最大同時実行数
 * @returns すべてのタスクの結果（成功/失敗を含む）
 */
async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<Array<{ index: number; success: boolean; result?: T; error?: unknown }>> {
  const results: Array<{ index: number; success: boolean; result?: T; error?: unknown }> = [];
  let currentIndex = 0;

  const worker = async (): Promise<void> => {
    while (currentIndex < tasks.length) {
      const index = currentIndex;
      currentIndex += 1;
      const task = tasks[index]!;

      try {
        const result = await task();
        results.push({ index, success: true, result });
      } catch (err) {
        results.push({ index, success: false, error: err });
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);

  return results.sort((a, b) => a.index - b.index);
}

function generatedBaseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const port = process.env.PORT?.trim() || "8787";
  return `http://localhost:${port}`;
}

export function startFullbodyMotionGenerationJob(params: {
  userId: string;
  jobId: string;
  photoBuffer: Buffer;
  mimeType: string;
}): void {
  void (async () => {
    const { userId, jobId, photoBuffer, mimeType } = params;
    try {
      const repoRoot = resolveRepoRoot();
      const pixelLabDir = path.join(repoRoot, "experiments/pixel_face_lab");
      const inputDir = path.join(pixelLabDir, "input");
      fs.mkdirSync(inputDir, { recursive: true });
      const inputPath = path.join(inputDir, `${jobId}.${photoExtensionFromMime(mimeType)}`);
      fs.writeFileSync(inputPath, photoBuffer);

      const baseRunName = `${jobId}_base`;
      store.updatePixelJobProgress(userId, jobId, 10);
      await runCommandWithRetry(
        repoRoot,
        [
          "experiments/pixel_face_lab/generate_fullbody_motion_gifs.py",
          "--input",
          inputPath,
          "--location",
          "global",
          "--model",
          "gemini-2.5-flash-image",
          "--temperature",
          "0",
          "--seed",
          "12031",
          "--base-only",
          "--frames-per-motion",
          "4",
          "--max-retries",
          "1",
          "--request-timeout-sec",
          "180",
          "--run-name",
          baseRunName,
        ],
        2,
      );

      const baseImageAbs = path.join(repoRoot, "experiments/pixel_face_lab/output", baseRunName, "base_fullbody.png");
      if (!fs.existsSync(baseImageAbs)) {
        throw new Error("ベース画像生成に失敗しました");
      }

      const motionGifUrls: Record<string, string> = {};
      const motionFrameUrls: Record<string, string[]> = {};
      const baseUrl = generatedBaseUrl();

      // 並列数6でモーション生成を実行
      const motionTasks = MOTION_PLAN.map((item, i) => {
        return async () => {
          const runName = `${jobId}_${item.motion}`;
          await runCommandWithRetry(
            repoRoot,
            [
              "experiments/pixel_face_lab/generate_fullbody_motion_gifs.py",
              "--input",
              inputPath,
              "--base-image",
              baseImageAbs,
              "--location",
              "global",
              "--model",
              "gemini-2.5-flash-image",
              "--temperature",
              "0",
              "--seed",
              String(13000 + i * 31),
              "--motions",
              item.motion,
              "--frames-per-motion",
              String(item.frames),
              "--max-retries",
              "1",
              "--request-timeout-sec",
              "180",
              "--run-name",
              runName,
            ],
            2,
          );

          const gifAbs = path.join(repoRoot, "experiments/pixel_face_lab/output", runName, "motions", item.motion, `${item.motion}.gif`);
          if (!fs.existsSync(gifAbs)) {
            throw new Error(`GIFが見つかりません: ${item.motion}`);
          }

          const frameUrls: string[] = [];
          for (let frameNo = 1; frameNo <= item.frames; frameNo += 1) {
            const frameName = `${String(frameNo).padStart(4, "0")}.png`;
            const frameAbs = path.join(
              repoRoot,
              "experiments/pixel_face_lab/output",
              runName,
              "motions",
              item.motion,
              "frames",
              frameName,
            );
            if (!fs.existsSync(frameAbs)) {
              throw new Error(`フレームが見つかりません: ${item.motion}/${frameName}`);
            }
            frameUrls.push(`${baseUrl}/generated/pixel_face_lab/output/${runName}/motions/${item.motion}/frames/${frameName}`);
          }

          return {
            motion: item.motion,
            gifUrl: `${baseUrl}/generated/pixel_face_lab/output/${runName}/motions/${item.motion}/${item.motion}.gif`,
            frameUrls,
          };
        };
      });

      // 並列数6で実行（レートリミット対策）
      const results = await runWithConcurrencyLimit(motionTasks, 6);

      // 結果を集計して進捗を更新
      let successCount = 0;
      for (let i = 0; i < results.length; i += 1) {
        const result = results[i]!;
        const motionItem = MOTION_PLAN[i]!;

        if (result.success) {
          motionGifUrls[result.result!.motion] = result.result!.gifUrl;
          motionFrameUrls[result.result!.motion] = result.result!.frameUrls;
          successCount += 1;
        } else {
          console.error(`[motion_generation_failed] motion=${motionItem.motion} error=`, result.error);
        }

        const completedCount = i + 1;
        const progress = 15 + Math.round((completedCount / MOTION_PLAN.length) * 80);
        store.updatePixelJobProgress(userId, jobId, progress);
      }

      // すべてのモーションが失敗した場合はエラー
      if (successCount === 0) {
        throw new Error("すべてのモーション生成に失敗しました");
      }

      const baseFullbodyUrl = `${baseUrl}/generated/pixel_face_lab/output/${baseRunName}/base_fullbody.png`;
      store.completePixelJob(userId, jobId, {
        base_fullbody_png: baseFullbodyUrl,
        motion_frame_urls: motionFrameUrls,
        motion_gif_urls: motionGifUrls,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      store.failPixelJob(params.userId, params.jobId, message);
    }
  })();
}
