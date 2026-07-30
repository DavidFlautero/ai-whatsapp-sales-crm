import { z } from "zod";

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/);

const nullableUrlSchema = z
  .union([
    z.string().url().max(1000),
    z.null(),
  ]);

export const platformBrandingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  shortName: z.string().trim().min(2).max(40),
  loginEyebrow: z.string().trim().min(2).max(80),
  loginTitle: z.string().trim().min(2).max(180),
  loginMessage: z.string().trim().min(2).max(500),
  loginButtonLabel: z.string().trim().min(2).max(60),
  supportEmail: z.string().trim().email().max(200),
  primaryColor: colorSchema,
  logoUrl: nullableUrlSchema,
});

export const companyBrandingSchema = z.object({
  shortName: z.string().trim().min(2).max(40),
  panelTitle: z.string().trim().min(2).max(120),
  panelSubtitle: z.string().trim().min(2).max(180),
  loginEyebrow: z.string().trim().min(2).max(80),
  loginTitle: z.string().trim().min(2).max(180),
  loginMessage: z.string().trim().min(2).max(500),
  loginButtonLabel: z.string().trim().min(2).max(60),
  robotName: z.string().trim().min(2).max(120),
  primaryColor: colorSchema,
  logoUrl: nullableUrlSchema,
});

export const companyRobotSchema = z.object({
  status: z.enum([
    "connected",
    "disconnected",
    "degraded",
    "pending",
  ]),
  phone: z.string().trim().min(3).max(40),
  provider: z.string().trim().min(2).max(100),
  webhookStatus: z.string().trim().min(2).max(50),
  aiStatus: z.string().trim().min(2).max(50),
});

export const companySubscriptionSchema = z.object({
  plan: z.string().trim().min(2).max(100),
  monthlyPrice: z.number().min(0).max(1000000),
  currency: z.string().trim().length(3).toUpperCase(),
  paymentStatus: z.enum([
    "active",
    "pending",
    "overdue",
    "cancelled",
  ]),
});

export const platformCompanySchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]+$/),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(180),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  branding: companyBrandingSchema,
  robot: companyRobotSchema,
  subscription: companySubscriptionSchema,
});

export const platformConfigSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  platform: platformBrandingSchema,
  companies: z.array(platformCompanySchema),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  legalName: z.string().trim().min(2).max(180).optional(),
  active: z.boolean().optional(),
});
