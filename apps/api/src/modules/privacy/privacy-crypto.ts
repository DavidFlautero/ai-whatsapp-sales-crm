import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  type PrivacyIdentifierKind,
  type PrivacyJson,
  type PrivacyJsonObject,
} from "./privacy.types.js";

export class PrivacyCryptoError
  extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "PrivacyCryptoError";

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function normalizeCompanyId(
  companyId: string,
): string {
  const normalized =
    companyId
      .trim()
      .toLowerCase();

  if (
    !/^[a-z0-9][a-z0-9_-]{0,63}$/
      .test(normalized)
  ) {
    throw new PrivacyCryptoError(
      "El identificador de empresa no es válido.",
    );
  }

  return normalized;
}

function normalizePhone(
  value: string,
): string {
  let normalized =
    value
      .normalize("NFKC")
      .trim()
      .replace(
        /[^\d+]/g,
        "",
      );

  if (
    normalized.startsWith("00")
  ) {
    normalized =
      `+${normalized.slice(2)}`;
  }

  const digits =
    normalized.replace(
      /\D/g,
      "",
    );

  if (
    digits.length < 7
    || digits.length > 15
  ) {
    throw new PrivacyCryptoError(
      "El teléfono no tiene una longitud válida.",
    );
  }

  return `+${digits}`;
}

function normalizeEmail(
  value: string,
): string {
  const normalized =
    value
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  if (
    normalized.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(normalized)
  ) {
    throw new PrivacyCryptoError(
      "El correo electrónico no es válido.",
    );
  }

  return normalized;
}

function normalizeOpaqueIdentifier(
  value: string,
): string {
  const normalized =
    value
      .normalize("NFKC")
      .trim();

  if (
    normalized.length < 3
    || normalized.length > 320
    || /[\u0000-\u001f\u007f]/
      .test(normalized)
  ) {
    throw new PrivacyCryptoError(
      "El identificador externo no es válido.",
    );
  }

  return normalized;
}

export function normalizePrivacyIdentifier(
  kind: PrivacyIdentifierKind,
  value: string,
): string {
  switch (kind) {
    case "phone":
      return normalizePhone(
        value,
      );

    case "email":
      return normalizeEmail(
        value,
      );

    case "external_id":
    case "customer_id":
    case "mixed":
      return normalizeOpaqueIdentifier(
        value,
      );
  }
}

function resolveHmacSecret(
  explicitSecret?: string,
): string {
  const secret =
    explicitSecret?.trim()
    || process.env
      .PRIVACY_HMAC_SECRET
      ?.trim()
    || "";

  if (
    secret.length < 32
  ) {
    throw new PrivacyCryptoError(
      "PRIVACY_HMAC_SECRET debe tener al menos 32 caracteres.",
    );
  }

  return secret;
}

function hmacHex(
  secret: string,
  value: string,
): string {
  return createHmac(
    "sha256",
    secret,
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function hmacBase64Url(
  secret: string,
  value: string,
): string {
  return createHmac(
    "sha256",
    secret,
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "base64url",
    );
}

export interface PrivacySubjectIdentity {
  subjectKey: string;
  identifierDigest: string;
  identifierKind:
    PrivacyIdentifierKind;
}

export function buildPrivacySubjectIdentity(
  input: {
    companyId: string;
    kind: PrivacyIdentifierKind;
    value: string;
    secret?: string;
  },
): PrivacySubjectIdentity {
  const companyId =
    normalizeCompanyId(
      input.companyId,
    );

  const normalized =
    normalizePrivacyIdentifier(
      input.kind,
      input.value,
    );

  const secret =
    resolveHmacSecret(
      input.secret,
    );

  const namespace =
    [
      "privacy",
      "v1",
      companyId,
      input.kind,
      normalized,
    ].join("|");

  return {
    subjectKey:
      `ps_${hmacBase64Url(
        secret,
        `subject|${namespace}`,
      )}`,

    identifierDigest:
      hmacHex(
        secret,
        `identifier|${namespace}`,
      ),

    identifierKind:
      input.kind,
  };
}

function canonicalize(
  value: unknown,
): unknown {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) {
    return value;
  }

  if (
    typeof value === "number"
  ) {
    if (
      !Number.isFinite(value)
    ) {
      throw new PrivacyCryptoError(
        "No se permiten números no finitos.",
      );
    }

    return value;
  }

  if (
    typeof value === "bigint"
  ) {
    return value.toString();
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      canonicalize,
    );
  }

  if (
    typeof value === "object"
  ) {
    const source =
      value as Record<
        string,
        unknown
      >;

    const result:
      Record<string, unknown> = {};

    for (
      const key
      of Object.keys(source).sort()
    ) {
      const child =
        source[key];

      if (
        child !== undefined
      ) {
        result[key] =
          canonicalize(child);
      }
    }

    return result;
  }

  throw new PrivacyCryptoError(
    "El contenido no puede canonicalizarse.",
  );
}

export function canonicalPrivacyJson(
  value: unknown,
): string {
  return JSON.stringify(
    canonicalize(value),
  );
}

export function computePrivacyEvidenceDigest(
  value: unknown,
): string {
  return createHash(
    "sha256",
  )
    .update(
      canonicalPrivacyJson(
        value,
      ),
      "utf8",
    )
    .digest(
      "hex",
    );
}

export function constantTimeDigestEquals(
  left: string,
  right: string,
): boolean {
  if (
    !/^[0-9a-f]{64}$/.test(left)
    || !/^[0-9a-f]{64}$/.test(right)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(
      left,
      "hex",
    ),
    Buffer.from(
      right,
      "hex",
    ),
  );
}

const sensitiveKeyPattern =
  /(?:phone|email|address|message|transcript|audio|recording|token|secret|authorization|cookie|password|proof|identifier|raw_payload)/i;

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): PrivacyJson {
  if (
    depth > 8
  ) {
    return "[max-depth]";
  }

  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) {
    return value;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (
    typeof value === "bigint"
  ) {
    return value.toString();
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      (item) =>
        sanitizeValue(
          item,
          depth + 1,
          seen,
        ),
    );
  }

  if (
    typeof value === "object"
  ) {
    if (
      seen.has(value)
    ) {
      return "[circular]";
    }

    seen.add(value);

    const source =
      value as Record<
        string,
        unknown
      >;

    const output:
      PrivacyJsonObject = {};

    for (
      const [
        key,
        child,
      ]
      of Object.entries(source)
    ) {
      output[key] =
        sensitiveKeyPattern.test(key)
          ? "[redacted]"
          : sanitizeValue(
              child,
              depth + 1,
              seen,
            );
    }

    return output;
  }

  return null;
}

export function sanitizePrivacyAuditPayload(
  value: unknown,
): PrivacyJson {
  return sanitizeValue(
    value,
    0,
    new WeakSet<object>(),
  );
}

export function redactPrivacyIdentifier(
  value: string,
): string {
  const normalized =
    value
      .normalize("NFKC")
      .trim();

  const suffix =
    normalized
      .replace(
        /\s/g,
        "",
      )
      .slice(-4);

  return suffix
    ? `***${suffix}`
    : "***";
}

export function createPrivacyRequestCode(
  now:
    Date = new Date(),
): string {
  const date =
    now
      .toISOString()
      .slice(0, 10)
      .replace(
        /-/g,
        "",
      );

  const random =
    randomBytes(6)
      .toString("hex")
      .toUpperCase();

  return `DSAR-${date}-${random}`;
}

export function createPrivacyIdempotencyKey():
  string {
  return [
    "privacy",
    Date.now().toString(36),
    randomBytes(16)
      .toString("base64url"),
  ].join(":");
}
