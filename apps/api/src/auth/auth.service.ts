import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { authConfig } from "./auth.config.js";
import type { SessionUser, UserRole } from "./auth.types.js";

const jwtSecret = new TextEncoder().encode(authConfig.secret);

export async function authenticateUser(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const record = authConfig.users.find(
    (user) =>
      user.active &&
      user.email.toLowerCase() === normalizedEmail,
  );

  if (!record) {
    await bcrypt.compare(
      password,
      "$2b$12$C6UzMDM.H6dfI/f/IKcEe.3QXeEaoFfQwK3HOFM9TFsQY9N9Kd7yW",
    );

    return null;
  }

  const valid = await bcrypt.compare(password, record.passwordHash);

  if (!valid) {
    return null;
  }

  const { passwordHash: _passwordHash, ...user } = record;
  return user;
}

export async function createSessionToken(
  user: SessionUser,
): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer("fulanitas-api")
    .setAudience("fulanitas-dashboard")
    .setIssuedAt()
    .setExpirationTime(`${authConfig.sessionHours}h`)
    .sign(jwtSecret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret, {
      issuer: "fulanitas-api",
      audience: "fulanitas-dashboard",
    });

    if (
      !payload.sub ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    const role = payload.role as UserRole;

    if (!["admin", "supervisor", "vendedor"].includes(role)) {
      return null;
    }

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role,
      active: payload.active === true,
    };
  } catch {
    return null;
  }
}
