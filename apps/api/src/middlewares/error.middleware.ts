import type { NextFunction, Request, Response } from "express";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[api:error]", error);

  res.status(500).json({
    ok: false,
    error: "Internal server error"
  });
}
