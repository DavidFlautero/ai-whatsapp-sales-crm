import { env } from "../../config/env.js";

function mask(value?: string) {
  if (!value) return { configured: false, preview: null };
  return {
    configured: true,
    preview: `••••${value.slice(-6)}`
  };
}

export async function getSystemStatus() {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    services: {
      whatsapp: {
        status: env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID ? "online" : "missing_config",
        token: mask(env.WHATSAPP_TOKEN),
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? null
      },
      claude: {
        status: env.ANTHROPIC_API_KEY ? "configured" : "missing_config",
        apiKey: mask(env.ANTHROPIC_API_KEY)
      },
      ninox: {
        status: env.NINOX_API_KEY ? "configured" : "pending",
        apiKey: mask(env.NINOX_API_KEY),
        baseUrl: env.NINOX_BASE_URL ?? null
      },
      database: {
        status: env.DATABASE_URL ? "configured" : "pending",
        url: mask(env.DATABASE_URL)
      },
      webhook: {
        verifyToken: mask(env.WHATSAPP_VERIFY_TOKEN)
      }
    }
  };
}
