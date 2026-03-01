import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";
import { verifyAccessToken } from "../lib/auth.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const auth = req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    next(new HttpError(401, "unauthorized", "認証が必要です"));
    return;
  }

  const token = auth.slice("Bearer ".length).trim();
  try {
    const userId = await verifyAccessToken(token);
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
