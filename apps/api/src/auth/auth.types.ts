export type UserRole =
  | "superadmin"
  | "owner"
  | "admin"
  | "supervisor"
  | "vendedor";

export type AuthUserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  companyId: string | null;
  active: boolean;
};

export type SessionUser = Omit<AuthUserRecord, "passwordHash">;
