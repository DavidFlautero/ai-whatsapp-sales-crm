import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import { loadCompanySecretMasterKey } from "./company-secret-master-key.service.js";

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
    loadCompanySecretMasterKey(context.companyId),
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

  const key = loadCompanySecretMasterKey(context.companyId);

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
