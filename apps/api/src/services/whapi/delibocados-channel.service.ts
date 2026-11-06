import { readFileSync } from "node:fs";

const CONFIG =
  "/root/delibocados-ai-whapi.json";

export type DelibocadosChannel = {
  enabled: boolean;
  phone: string;
  token: string;
  testPhone?: string;
};

export function getDelibocadosChannel():
  DelibocadosChannel {
  let data: DelibocadosChannel;

  try {
    data = JSON.parse(
      readFileSync(CONFIG, "utf8")
    );
  } catch {
    throw new Error(
      "DELIBOCADOS_CHANNEL_NOT_CONFIGURED"
    );
  }

  if (
    data.enabled !== true ||
    !/^[0-9]{8,15}$/.test(data.phone) ||
    !data.token?.trim()
  ) {
    throw new Error(
      "DELIBOCADOS_CHANNEL_INVALID"
    );
  }

  return data;
}

export function getDelibocadosToken(): string {
  return getDelibocadosChannel().token;
}
