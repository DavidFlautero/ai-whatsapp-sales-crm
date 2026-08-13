import type { AuthUserRecord, UserRole } from "./auth.types.js";

const validRoles = new Set<UserRole>([
  "superadmin",
  "owner",
  "admin",
  "supervisor",
  "vendedor",
]);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function normalizeUserPhone(
  value: unknown,
): string | null {
  const digits =
    String(
      value ?? "",
    )
      .replace(
        /\D/g,
        "",
      );

  if (!digits) {
    return null;
  }

  if (
    digits.length < 8
    || digits.length > 15
  ) {
    throw new Error(
      "Invalid auth user phone",
    );
  }

  return digits;
}


function parseUsers(): AuthUserRecord[] {
  const raw = requiredEnv("AUTH_USERS_JSON");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("AUTH_USERS_JSON must be an array");
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid auth user at index ${index}`);
    }

    const user = item as Partial<AuthUserRecord>;

    if (
      !user.id ||
      !user.name ||
      !user.email ||
      !user.passwordHash ||
      !user.role ||
      !validRoles.has(user.role)
    ) {
      throw new Error(`Invalid auth user at index ${index}`);
    }

    const companyId =
      user.role === "superadmin"
        ? null
        : user.companyId || process.env.DEFAULT_COMPANY_ID || "fulanitas";

    return {
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      role: user.role,
      companyId,

      phone:
        normalizeUserPhone(
          user.phone,
        ),

      active: user.active !== false,
    };
  });
}

const sessionHours = Number(
  process.env.AUTH_SESSION_HOURS || "12",
);

if (!Number.isFinite(sessionHours) || sessionHours <= 0) {
  throw new Error(
    "AUTH_SESSION_HOURS must be a positive number",
  );
}

export const authConfig = {
  secret: requiredEnv("AUTH_SECRET"),
  cookieName:
    process.env.AUTH_COOKIE_NAME?.trim() ||
    "fulanitas_session",
  sessionHours,
  users: parseUsers(),
};
