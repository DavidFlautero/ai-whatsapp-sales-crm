import fs from "node:fs";
import {
  execFileSync,
} from "node:child_process";
import {
  createHash,
  verify,
} from "node:crypto";
import {
  dirname,
  resolve,
} from "node:path";
import {
  fileURLToPath,
} from "node:url";


export type RuntimeCapability =
  | "api"
  | "whatsapp"
  | "catalog"
  | "sales-agent"
  | "vision"
  | "learning";


type LicensePayload = {
  version:
    number;

  licenseId:
    string;

  customer:
    string;

  installationFingerprint:
    string;

  issuedAt:
    string;

  expiresAt:
    string | null;

  features:
    RuntimeCapability[];
};


type SignedLicense = {
  payload:
    LicensePayload;

  signature:
    string;
};


export type RuntimeIntegrityStatus = {
  valid:
    boolean;

  reason:
    string | null;

  signatureValid:
    boolean;

  fingerprintMatch:
    boolean;

  customerMatch:
    boolean;

  notExpired:
    boolean;

  featuresValid:
    boolean;

  customer:
    string | null;

  licenseId:
    string | null;

  currentFingerprint:
    string;

  licensedFingerprint:
    string | null;

  features:
    RuntimeCapability[];
};


const EXPECTED_CUSTOMER =
  "fulanitas";


const REQUIRED_FEATURES:
  RuntimeCapability[] = [
    "api",
    "whatsapp",
    "catalog",
    "sales-agent",
    "vision",
    "learning",
  ];


/*
 * Clave PÚBLICA.
 *
 * La private key jamás existe
 * en esta VPS.
 */
const PUBLIC_KEY_B64 =
  "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUNvd0JRWURLMlZ3QXlFQXZuK3JqTGZGdDdrU0liVGpRcTF1MnYrbGFaanQ5eXFtUndtSTQ5REw2bEE9Ci0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=";


const here =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );


const LICENSE_FILE =
  resolve(
    here,
    "../../../data/license/license.json",
  );


function safeRead(
  path:
    string,
) {
  try {
    return fs
      .readFileSync(
        path,
        "utf8",
      )
      .trim();
  } catch {
    return "";
  }
}


function safeExec(
  command:
    string,

  args:
    string[],
) {
  try {
    return execFileSync(
      command,
      args,
      {
        encoding:
          "utf8",

        stdio: [
          "ignore",
          "pipe",
          "ignore",
        ],
      },
    )
      .trim();
  } catch {
    return "";
  }
}


function stableStringify(
  value:
    unknown,
): string {
  if (
    value === null
    || typeof value
      !== "object"
  ) {
    return (
      JSON.stringify(
        value,
      )
      ?? "null"
    );
  }


  if (
    Array.isArray(
      value,
    )
  ) {
    return (
      "["
      + value
        .map(
          stableStringify,
        )
        .join(",")
      + "]"
    );
  }


  const record =
    value as Record<
      string,
      unknown
    >;


  return (
    "{"
    + Object.keys(
        record,
      )
        .sort()
        .map(
          (key) =>
            JSON.stringify(
              key,
            )
            + ":"
            + stableStringify(
              record[key],
            ),
        )
        .join(",")
    + "}"
  );
}


export function getInstallationFingerprint() {
  /*
   * IMPORTANTE:
   * mantener exactamente las mismas
   * señales y orden usados al emitir
   * la licencia.
   */
  const identity = {
    machineId:
      safeRead(
        "/etc/machine-id",
      ),

    productUuid:
      safeRead(
        "/sys/class/dmi/id/product_uuid",
      ),

    productSerial:
      safeRead(
        "/sys/class/dmi/id/product_serial",
      ),

    boardSerial:
      safeRead(
        "/sys/class/dmi/id/board_serial",
      ),

    rootFilesystemUuid:
      safeExec(
        "findmnt",
        [
          "-no",
          "UUID",
          "/",
        ],
      ),
  };


  return createHash(
    "sha256",
  )
    .update(
      JSON.stringify(
        identity,
      ),
    )
    .digest(
      "hex",
    );
}


function parseLicense():
  SignedLicense {
  const raw =
    fs.readFileSync(
      LICENSE_FILE,
      "utf8",
    );


  const parsed =
    JSON.parse(
      raw,
    ) as Partial<SignedLicense>;


  if (
    !parsed.payload
    || !parsed.signature
    || typeof parsed.signature
      !== "string"
  ) {
    throw new Error(
      "STATE_A06",
    );
  }


  return parsed as SignedLicense;
}


let cachedStatus:
  RuntimeIntegrityStatus | null =
  null;


export function getRuntimeState(
  options?: {
    refresh?:
      boolean;
  },
): RuntimeIntegrityStatus {
  if (
    cachedStatus
    && !options?.refresh
  ) {
    return cachedStatus;
  }


  const currentFingerprint =
    getInstallationFingerprint();


  try {
    const license =
      parseLicense();


    const publicKeyPem =
      Buffer
        .from(
          PUBLIC_KEY_B64,
          "base64",
        )
        .toString(
          "utf8",
        );


    const canonical =
      stableStringify(
        license.payload,
      );


    let signatureValid =
      false;


    try {
      signatureValid =
        verify(
          null,

          Buffer.from(
            canonical,
            "utf8",
          ),

          publicKeyPem,

          Buffer.from(
            license.signature,
            "base64url",
          ),
        );
    } catch {
      signatureValid =
        false;
    }


    const fingerprintMatch =
      license.payload
        .installationFingerprint
      === currentFingerprint;


    const customerMatch =
      license.payload.customer
      === EXPECTED_CUSTOMER;


    const expiresAt =
      license.payload.expiresAt;


    const notExpired =
      !expiresAt
      || (
        Number.isFinite(
          new Date(
            expiresAt,
          ).getTime(),
        )
        && new Date(
          expiresAt,
        ).getTime()
          > Date.now()
      );


    const features =
      Array.isArray(
        license.payload.features,
      )
        ? license.payload.features
        : [];


    const featuresValid =
      REQUIRED_FEATURES.every(
        (feature) =>
          features.includes(
            feature,
          ),
      );


    const valid =
      signatureValid
      && fingerprintMatch
      && customerMatch
      && notExpired
      && featuresValid;


    let reason:
      string | null =
      null;


    if (!signatureValid) {
      reason =
        "STATE_A01";
    } else if (!fingerprintMatch) {
      reason =
        "STATE_A02";
    } else if (!customerMatch) {
      reason =
        "STATE_A03";
    } else if (!notExpired) {
      reason =
        "STATE_A04";
    } else if (!featuresValid) {
      reason =
        "STATE_A05";
    }


    cachedStatus = {
      valid,
      reason,

      signatureValid,
      fingerprintMatch,
      customerMatch,
      notExpired,
      featuresValid,

      customer:
        license.payload.customer,

      licenseId:
        license.payload.licenseId,

      currentFingerprint,

      licensedFingerprint:
        license.payload
          .installationFingerprint,

      features,
    };


    return cachedStatus;

  } catch (
    error
  ) {
    cachedStatus = {
      valid:
        false,

      reason:
        error instanceof Error
          ? error.message
          : "STATE_A07",

      signatureValid:
        false,

      fingerprintMatch:
        false,

      customerMatch:
        false,

      notExpired:
        false,

      featuresValid:
        false,

      customer:
        null,

      licenseId:
        null,

      currentFingerprint,

      licensedFingerprint:
        null,

      features:
        [],
    };


    return cachedStatus;
  }
}


export function ensureRuntimeAccess(
  feature:
    RuntimeCapability,
) {
  const status =
    getRuntimeState();


  if (!status.valid) {
    throw new Error(
      `RUNTIME_STATE_INVALID:${status.reason ?? "UNKNOWN"}`,
    );
  }


  if (
    !status.features.includes(
      feature,
    )
  ) {
    throw new Error(
      `RUNTIME_ACCESS_DENIED:${feature}`,
    );
  }


  return status;
}
