import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";

interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

function nowMs(): number {
  return Date.now();
}

export function makeRateLimiter(keyPrefix: string, limit: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const actor = req.userId ?? req.ip ?? "unknown";
    const key = `${keyPrefix}:${actor}`;
    const ts = nowMs();
    const current = buckets.get(key);

    if (!current || ts >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: ts + windowMs });
      next();
      return;
    }

    if (current.count >= limit) {
      next(new HttpError(429, "rate_limited", "リクエスト上限に達しました。しばらく待ってから再試行してください"));
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
}
