import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendPublicError(
  req: Request,
  res: Response,
  status: number,
  code: string,
  error: string,
  detail?: unknown,
) {
  if (detail) {
    const stack = detail instanceof Error ? detail.stack : detail;
    console.error(
      JSON.stringify({
        requestId: req.requestId,
        code,
        status,
        detail: stack,
      }),
    );
  }
  res.status(status).json({ error, code, requestId: req.requestId });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const httpError = err instanceof HttpError ? err : null;
  const status = httpError?.status || 500;
  const code = httpError?.code || "internal_error";
  const error =
    status >= 500
      ? "Internal server error"
      : httpError?.message || "Request failed";
  sendPublicError(req, res, status, code, error, err);
}
