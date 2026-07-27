import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../../../.env")
});

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  APP_BASE_URL: z.string().default("http://localhost:4000"),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().default("ventas_ia_verify_token_2026"),
  WHATSAPP_GRAPH_VERSION: z.string().default("v25.0"),

  NINOX_API_KEY: z.string().optional(),
  NINOX_BASE_URL: z.string().optional(),
  NINOX_WEBHOOK_SECRET: z.string().optional(),

  DATABASE_URL: z.string().optional(),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional()
});

export const env = schema.parse(process.env);
