import { createHash } from "node:crypto";
import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import {
  encryptCompanySecret,
  decryptCompanySecret,
  type CompanySecretContext,
} from "./company-secret-crypto.js";

type StoredSecret = {
  company_id: string;
  provider: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
};

function masterKey(): Buffer {
  // Prefer a dedicated company key, but allow the already deployed
  // AES-256-GCM integration master key during the migration.
  const dedicated =
    process.env.COMPANY_INTEGRATION_MASTER_KEY_HEX?.trim() ?? "";

  if (dedicated) {
    if (!/^[a-fA-F0-9]{64}$/.test(dedicated)) {
      throw new Error("COMPANY_MASTER_KEY_INVALID");
    }
    return Buffer.from(dedicated, "hex");
  }

  const shared = process.env.INTEGRATIONS_MASTER_KEY?.trim() ?? "";
  if (!shared) {
    throw new Error("COMPANY_MASTER_KEY_NOT_CONFIGURED");
  }
  return /^[a-fA-F0-9]{64}$/.test(shared)
    ? Buffer.from(shared, "hex")
    : createHash("sha256").update(shared).digest();
}

function toDatabase(value: Buffer): string {
  return "\\x" + value.toString("hex");
}

function fromDatabase(value: string): Buffer {
  if (
    typeof value !== "string" ||
    !/^\\x(?:[0-9a-fA-F]{2})+$/.test(value)
  ) {
    throw new Error("INVALID_DATABASE_CIPHERTEXT");
  }

  return Buffer.from(value.slice(2), "hex");
}

function validateContext(
  context: CompanySecretContext,
): void {
  if (
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(context.companyId) ||
    !["ninox", "toteat", "pos360", "whapi", "native"]
      .includes(context.provider) ||
    !Number.isSafeInteger(context.keyVersion) ||
    context.keyVersion < 1
  ) {
    throw new Error("INVALID_SECRET_CONTEXT");
  }
}

export async function saveCompanySecret(
  context: CompanySecretContext,
  plaintext: string,
): Promise<void> {
  validateContext(context);

  const encrypted = encryptCompanySecret(
    plaintext,
    context,
    masterKey(),
  );

  await supabaseRequest<StoredSecret[]>({
    table: "company_integration_secrets",
    method: "POST",
    query: "?on_conflict=company_id,provider",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      company_id: context.companyId,
      provider: context.provider,
      ciphertext: toDatabase(encrypted.ciphertext),
      iv: toDatabase(encrypted.iv),
      auth_tag: toDatabase(encrypted.authTag),
      key_version: encrypted.keyVersion,
      updated_at: new Date().toISOString(),
    }],
  });
}

export async function readCompanySecret(
  context: CompanySecretContext,
): Promise<string | null> {
  validateContext(context);

  const key = masterKey();

  const rows = await supabaseRequest<StoredSecret[]>({
    table: "company_integration_secrets",
    query:
      "?select=company_id,provider,ciphertext,iv,auth_tag,key_version" +
      "&company_id=eq." +
      encodeURIComponent(context.companyId) +
      "&provider=eq." +
      encodeURIComponent(context.provider) +
      "&limit=1",
  });

  const record = rows[0];

  if (!record) {
    return null;
  }

  if (
    record.company_id !== context.companyId ||
    record.provider !== context.provider ||
    record.key_version !== context.keyVersion
  ) {
    throw new Error("SECRET_SCOPE_MISMATCH");
  }

  return decryptCompanySecret({
    ciphertext: fromDatabase(record.ciphertext),
    iv: fromDatabase(record.iv),
    authTag: fromDatabase(record.auth_tag),
    keyVersion: record.key_version,
  }, context, key);
}
