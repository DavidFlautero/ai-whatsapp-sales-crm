import { readFileSync } from "node:fs";

import { supabaseRequest } from "../db/supabase-rest.client.js";
import {
  getCompanyIntegration,
} from "../integrations/company-integration.repository.js";
import {
  readCompanySecret,
  saveCompanySecret,
} from "../integrations/company-secret.repository.js";

const COMPANY = "delibocados";
const LEGACY_CONFIG = "/root/delibocados-ai-whapi.json";
const context = {
  companyId: COMPANY,
  provider: "whapi",
  keyVersion: 1,
} as const;

export type DelibocadosChannel = {
  enabled: boolean;
  phone: string;
  token: string;
  testPhone: string;
};

function validate(data: unknown): DelibocadosChannel {
  const item = data as Partial<DelibocadosChannel> | null;
  if (
    item?.enabled !== true ||
    !/^[0-9]{8,15}$/.test(item.phone ?? "") ||
    !/^[0-9]{8,15}$/.test(item.testPhone ?? "") ||
    !item.token?.trim()
  ) {
    throw new Error("DELIBOCADOS_CHANNEL_INVALID");
  }
  return {
    enabled: true,
    phone: item.phone!,
    testPhone: item.testPhone!,
    token: item.token.trim(),
  };
}

/** A scoped encrypted secret takes priority over the temporary legacy file. */
export async function getDelibocadosChannel(): Promise<DelibocadosChannel> {
  const registration = await getCompanyIntegration(COMPANY, "whapi");
  if (registration) {
    if (!registration.enabled || registration.status !== "connected") {
      throw new Error("DELIBOCADOS_CHANNEL_NOT_CONFIGURED");
    }
    const value = await readCompanySecret(context);
    if (!value) throw new Error("DELIBOCADOS_CHANNEL_NOT_CONFIGURED");
    return validate(JSON.parse(value) as unknown);
  }

  try {
    return validate(JSON.parse(readFileSync(LEGACY_CONFIG, "utf8")) as unknown);
  } catch {
    throw new Error("DELIBOCADOS_CHANNEL_NOT_CONFIGURED");
  }
}

export async function getDelibocadosToken(): Promise<string> {
  return (await getDelibocadosChannel()).token;
}

export async function delibocadosChannelStatus(): Promise<{
  connected: boolean;
  phone: string | null;
  testPhone: string | null;
}> {
  try {
    const channel = await getDelibocadosChannel();
    return {
      connected: true,
      phone: channel.phone,
      testPhone: channel.testPhone,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      ["DELIBOCADOS_CHANNEL_NOT_CONFIGURED", "DELIBOCADOS_CHANNEL_INVALID"]
        .includes(error.message)
    ) {
      return { connected: false, phone: null, testPhone: null };
    }
    throw error;
  }
}

export async function configureDelibocadosChannel(input: {
  token: string;
  phone: string;
  testPhone: string;
}): Promise<void> {
  const token = String(input.token ?? "").trim();
  const phone = String(input.phone ?? "").replace(/\D/g, "");
  const testPhone = String(input.testPhone ?? "").replace(/\D/g, "");

  if (
    token.length < 16 ||
    token.length > 1024 ||
    !/^[0-9]{8,15}$/.test(phone) ||
    !/^[0-9]{8,15}$/.test(testPhone)
  ) {
    throw new Error("DELIBOCADOS_CHANNEL_INPUT_INVALID");
  }

  const response = await fetch("https://gate.whapi.cloud/health?wakeup=false", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`DELIBOCADOS_WHAPI_AUTH_HTTP_${response.status}`);
  }

  const health = await response.json().catch(() => ({})) as {
    user?: { id?: string };
  };
  const sender = String(health.user?.id ?? "")
    .split("@")[0].replace(/\D/g, "");
  if (!sender) {
    throw new Error("DELIBOCADOS_WHAPI_NO_AUTHENTICATED_SENDER");
  }
  if (sender !== phone) {
    throw new Error("DELIBOCADOS_WHAPI_WRONG_SENDER");
  }

  // FK prerequisite; keep pending until encryption is committed.
  await supabaseRequest<unknown[]>({
    table: "company_integrations",
    method: "POST",
    query: "?on_conflict=company_id,provider",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      company_id: COMPANY,
      provider: "whapi",
      enabled: false,
      status: "pending",
      updated_at: new Date().toISOString(),
    }],
  });

  await saveCompanySecret(context, JSON.stringify({
    enabled: true,
    phone,
    testPhone,
    token,
  } satisfies DelibocadosChannel));

  await supabaseRequest<unknown[]>({
    table: "company_integrations",
    method: "POST",
    query: "?on_conflict=company_id,provider",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      company_id: COMPANY,
      provider: "whapi",
      enabled: true,
      status: "connected",
      updated_at: new Date().toISOString(),
    }],
  });
}
