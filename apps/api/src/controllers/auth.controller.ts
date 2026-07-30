import type { Request, Response } from "express";
import { z } from "zod";
import { authConfig } from "../auth/auth.config.js";
import {
  authenticateUser,
  createSessionToken,
} from "../auth/auth.service.js";

const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
};

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_CREDENTIALS",
      message: "Revisá el correo y la contraseña.",
    });
  }

  const user = await authenticateUser(
    parsed.data.email,
    parsed.data.password,
  );

  if (!user) {
    return res.status(401).json({
      ok: false,
      error: "INVALID_CREDENTIALS",
      message: "Correo o contraseña incorrectos.",
    });
  }

  const token = await createSessionToken(user);

  res.cookie(authConfig.cookieName, token, {
    ...cookieOptions,
    maxAge: authConfig.sessionHours * 60 * 60 * 1000,
  });

  return res.json({
    ok: true,
    user,
  });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(authConfig.cookieName, cookieOptions);
  return res.json({ ok: true });
}

export function getSession(req: Request, res: Response) {
  return res.json({
    ok: true,
    user: req.authUser,
  });
}
