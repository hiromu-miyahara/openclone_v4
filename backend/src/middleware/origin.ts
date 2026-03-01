import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";

const STATE_CHANGING_METHODS = new Set(["POST", "DELETE"]);

export function requireAllowedOriginForStateChanging(allowedOrigins: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const origin = String(req.header("origin") ?? "").trim();
    if (!origin) {
      next(new HttpError(403, "forbidden", "state-changing API には Origin ヘッダが必須です"));
      return;
    }

    if (!allowedOrigins.includes(origin)) {
      next(new HttpError(403, "forbidden", "許可されていないオリジンです"));
      return;
    }

    next();
  };
}
