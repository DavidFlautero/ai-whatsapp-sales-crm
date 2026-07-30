export type UserRole = "admin" | "supervisor" | "vendedor";

export type AuthUserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
};

export type SessionUser = Omit<AuthUserRecord, "passwordHash">;
