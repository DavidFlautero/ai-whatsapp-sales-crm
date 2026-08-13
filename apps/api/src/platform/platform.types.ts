export type RobotStatus =
  | "connected"
  | "disconnected"
  | "degraded"
  | "pending";

export type PaymentStatus =
  | "active"
  | "pending"
  | "overdue"
  | "cancelled";

export type CompanyBranding = {
  shortName: string;
  panelTitle: string;
  panelSubtitle: string;
  loginEyebrow: string;
  loginTitle: string;
  loginMessage: string;
  loginButtonLabel: string;
  robotName: string;
  primaryColor: string;
  logoUrl: string | null;
heroImageUrl: string | null;
};

export type CompanyRobot = {
  status: RobotStatus;
  phone: string;
  provider: string;
  webhookStatus: string;
  aiStatus: string;
};

export type CompanySubscription = {
  plan: string;
  monthlyPrice: number;
  currency: string;
  paymentStatus: PaymentStatus;
};

export type PlatformCompany = {
  id: string;
  slug: string;
  name: string;
  legalName: string;
  active: boolean;
  createdAt: string;
  branding: CompanyBranding;
  robot: CompanyRobot;
  subscription: CompanySubscription;
};

export type PlatformBranding = {
  name: string;
  shortName: string;
  loginEyebrow: string;
  loginTitle: string;
  loginMessage: string;
  loginButtonLabel: string;
  supportEmail: string;
  primaryColor: string;
  logoUrl: string | null;
};

export type PlatformConfig = {
  version: number;
  updatedAt: string;
  platform: PlatformBranding;
  companies: PlatformCompany[];
};
