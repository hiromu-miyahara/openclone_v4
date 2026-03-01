import type { NextFunction, Request, Response } from "express";
import { HttpError, sendError } from "../lib/http.js";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, {
    code: "resource_not_found",
    message: `Not Found: ${req.method} ${req.path}`,
    request_id: req.requestId,
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    sendError(res, err.status, {
      code: err.code,
      message: err.message,
      request_id: req.requestId,
    });
    return;
  }

  sendError(res, 500, {
    code: "internal_error",
    message: "サーバ内部エラー",
    request_id: req.requestId,
  });
}
