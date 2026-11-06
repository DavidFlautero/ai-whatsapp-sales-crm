import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export type CompanyEncryptedSecret = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
};

export type CompanySecretContext = {
  companyId: string;
  provider: string;
  keyVersion: number;
};

function validateContext(context: CompanySecretContext): void {
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

function deriveKey(
  masterKey: Buffer,
  context: CompanySecretContext,
): Buffer {
  validateContext(context);

  if (masterKey.length !== 32) {
    throw new Error("INVALID_MASTER_KEY");
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      masterKey,
      Buffer.from("neuromind-company-secrets-v1"),
      Buffer.from(JSON.stringify([
        context.companyId,
        context.provider,
        context.keyVersion,
      ])),
      32,
    ),
  );
}

function associatedData(
  context: CompanySecretContext,
): Buffer {
  return Buffer.from(JSON.stringify([
    "neuromind-company-secret-v1",
    context.companyId,
    context.provider,
    context.keyVersion,
  ]));
}

export function encryptCompanySecret(
  plaintext: string,
  context: CompanySecretContext,
  masterKey: Buffer,
): CompanyEncryptedSecret {
  if (!plaintext) {
    throw new Error("EMPTY_SECRET");
  }

  const key = deriveKey(masterKey, context);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  cipher.setAAD(associatedData(context));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext,
    iv,
    authTag: cipher.getAuthTag(),
    keyVersion: context.keyVersion,
  };
}

export function decryptCompanySecret(
  encrypted: CompanyEncryptedSecret,
  context: CompanySecretContext,
  masterKey: Buffer,
): string {
  if (
    encrypted.iv.length !== 12 ||
    encrypted.authTag.length !== 16 ||
    encrypted.ciphertext.length === 0 ||
    encrypted.keyVersion !== context.keyVersion
  ) {
    throw new Error("INVALID_ENCRYPTED_SECRET");
  }

  const key = deriveKey(masterKey, context);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    encrypted.iv,
  );

  decipher.setAAD(associatedData(context));
  decipher.setAuthTag(encrypted.authTag);

  return Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
