import type { NextFunction, Request, Response } from "express";
import { authConfig } from "../auth/auth.config.js";
import { verifySessionToken } from "../auth/auth.service.js";
import type {
  SessionUser,
  UserRole,
} from "../auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: SessionUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const cookieToken = req.cookies?.[authConfig.cookieName];

  const bearerToken = req.headers.authorization?.match(
    /^Bearer\s+(.+)$/i,
  )?.[1];

  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: "AUTHENTICATION_REQUIRED",
    });
  }

  const user = await verifySessionToken(token);

  if (!user?.active) {
    return res.status(401).json({
      ok: false,
      error: "INVALID_OR_EXPIRED_SESSION",
    });
  }

  req.authUser = user;
  return next();
}

export function requireRoles(...roles: UserRole[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      return res.status(403).json({
        ok: false,
        error: "INSUFFICIENT_PERMISSIONS",
      });
    }

    return next();
  };
}
