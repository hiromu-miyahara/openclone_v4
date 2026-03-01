import type { Response } from "express";
import type { ApiErrorBody, ErrorCode } from "../types/api.js";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendError(res: Response, status: number, body: ApiErrorBody): void {
  res.status(status).json(body);
}
