import { Router, type Request, type Response } from "express";
import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  supabaseRequest,
  supabaseRpc,
} from "../services/db/supabase-rest.client.js";

export const ownerCredentialsRoutes = Router();

const derive = promisify(scrypt);
const COOKIE = "em_owner_session";
const WEEK = 7 * 86400000;
const WINDOW = 15 * 60000;

const attempts = new Map<string, {
  count: number;
  expires: number;
}>();

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function limit(req: Request, res: Response, user: string) {
  const key = `${req.ip}:${user}`;
  const now = Date.now();

  if (attempts.size > 5000) {
    for (const [k, v] of attempts) {
      if (v.expires <= now) attempts.delete(k);
    }
  }

  const record = attempts.get(key);

  if (!record || record.expires <= now) {
    attempts.set(key, { count: 1, expires: now + WINDOW });
    return false;
  }

  if (record.count >= 8) {
    res.setHeader("Retry-After", String(
      Math.ceil((record.expires - now) / 1000)
    ));
    res.status(429).json({
      ok: false,
      error: "TOO_MANY_ATTEMPTS",
    });
    return true;
  }

  record.count++;
  return false;
}

async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const result = await derive(
    password, Buffer.from(salt, "hex"), 64
  ) as Buffer;

  return `scrypt$v1$${salt}$${result.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== "scrypt" ||
    parts[1] !== "v1" ||
    !/^[0-9a-f]{32}$/.test(parts[2]) ||
    !/^[0-9a-f]{128}$/.test(parts[3])
  ) return false;

  const actual = await derive(
    password, Buffer.from(parts[2], "hex"), 64
  ) as Buffer;

  return timingSafeEqual(
    actual,
    Buffer.from(parts[3], "hex")
  );
}

function setSession(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });

  res.setHeader("Cache-Control", "no-store");

  return res.json({
    ok: true,
    authenticated: true,
  });
}

function safeOrigin(req: Request, res: Response) {
  if (req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({
      ok: false,
      error: "CROSS_SITE_REQUEST_DENIED",
    });
    return false;
  }
  return true;
}

const validUsername = (username: string) =>
  /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username);

const validPassword = (password: unknown) =>
  typeof password === "string" &&
  password.length >= 12 &&
  password.length <= 128;

// Evitar que el acceso antiguo por token omita la contraseña.
ownerCredentialsRoutes.post("/auth/redeem", (_req, res) => {
  return res.status(410).json({
    ok: false,
    error: "ACCOUNT_ACTIVATION_REQUIRED",
  });
});

ownerCredentialsRoutes.post("/auth/register", async (req, res) => {
  if (!safeOrigin(req, res)) return;

  const username = String(req.body?.username ?? "")
    .trim().toLowerCase();
  const password = req.body?.password;
  const inviteToken = req.body?.inviteToken;

  if (
    !validUsername(username) ||
    !validPassword(password) ||
    typeof inviteToken !== "string" ||
    inviteToken.length < 32 ||
    inviteToken.length > 256
  ) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_ACTIVATION_DATA",
    });
  }

  if (limit(req, res, `register:${username}`)) return;

  try {
    const sessionToken = randomBytes(32).toString("base64url");

    const rows = await supabaseRpc<
      Array<{ company_id: string; provider_id: string }>
    >("crm_owner_register", {
      p_invitation_hash: hash(inviteToken),
      p_username: username,
      p_password_hash: await passwordHash(password),
      p_session_hash: hash(sessionToken),
      p_session_expires_at:
        new Date(Date.now() + WEEK).toISOString(),
    });

    if (!Array.isArray(rows) || rows.length !== 1) {
      return res.status(409).json({
        ok: false,
        error: "INVALID_INVITATION_OR_USERNAME",
      });
    }

    return setSession(res, sessionToken);
  } catch (error) {
    console.error(
      "[OWNER REGISTER]",
      error instanceof Error ? error.message : "unknown"
    );
    return res.status(503).json({
      ok: false,
      error: "REGISTRATION_UNAVAILABLE",
    });
  }
});

type Account = {
  company_id: string;
  provider_id: string;
  activation_invitation_id: string;
  password_hash: string;
};

ownerCredentialsRoutes.post("/auth/login", async (req, res) => {
  if (!safeOrigin(req, res)) return;

  const username = String(req.body?.username ?? "")
    .trim().toLowerCase();
  const password = req.body?.password;

  if (!validUsername(username) || !validPassword(password)) {
    return res.status(401).json({
      ok: false,
      error: "INVALID_CREDENTIALS",
    });
  }

  if (limit(req, res, `login:${username}`)) return;

  try {
    const accounts = await supabaseRequest<Account[]>({
      table: "crm_venue_owner_accounts",
      query:
        `?username=eq.${encodeURIComponent(username)}` +
        "&select=company_id,provider_id," +
        "activation_invitation_id,password_hash&limit=1",
    });

    const account = accounts[0];

    // Trabajo criptográfico incluso para usuario inexistente.
    const fake = "scrypt$v1$" + "0".repeat(32) +
      "$" + "0".repeat(128);

    const valid = await verifyPassword(
      password,
      account?.password_hash ?? fake
    );

    if (!account || !valid) {
      return res.status(401).json({
        ok: false,
        error: "INVALID_CREDENTIALS",
      });
    }

    const providers = await supabaseRequest<
      Array<{ status: string }>
    >({
      table: "crm_providers",
      query:
        `?id=eq.${account.provider_id}` +
        `&company_id=eq.${encodeURIComponent(account.company_id)}` +
        "&select=status&limit=1",
    });

    if (providers[0]?.status !== "active") {
      return res.status(401).json({
        ok: false,
        error: "INVALID_CREDENTIALS",
      });
    }

    const sessionToken = randomBytes(32).toString("base64url");

    await supabaseRequest({
      table: "crm_venue_owner_sessions",
      method: "POST",
      body: {
        company_id: account.company_id,
        provider_id: account.provider_id,
        invitation_id: account.activation_invitation_id,
        token_hash: hash(sessionToken),
        expires_at: new Date(Date.now() + WEEK).toISOString(),
      },
    });

    attempts.delete(`${req.ip}:login:${username}`);

    return setSession(res, sessionToken);
  } catch (error) {
    console.error(
      "[OWNER LOGIN]",
      error instanceof Error ? error.message : "unknown"
    );
    return res.status(503).json({
      ok: false,
      error: "LOGIN_UNAVAILABLE",
    });
  }
});
