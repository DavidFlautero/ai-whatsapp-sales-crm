import bcrypt from "bcryptjs";

import {
  createHmac,
  randomInt,
} from "node:crypto";

import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
} from "node:path";

import {
  fileURLToPath,
} from "node:url";

import {
  authConfig,
} from "./auth.config.js";

import {
  readCatalogMediaSettings,
} from "../services/catalog/catalog-media.repository.js";

import {
  sendWhatsappText,
} from "../services/whatsapp/whatsapp.service.js";


const ADMIN_EMAIL =
  "admin@fulanitasfabrica.site";

const ADMIN_COMPANY =
  "fulanitas";

const OTP_TTL_MS =
  10 * 60 * 1000;

const OTP_COOLDOWN_MS =
  60 * 1000;

const MAX_ATTEMPTS =
  5;


type ResetState = {
  hash:
    string;

  expiresAt:
    number;

  attempts:
    number;

  lastSentAt:
    number;
};


type PasswordOverride = {
  passwordHash:
    string;

  passwordChangedAt:
    string;
};


type PasswordOverrideStore = {
  version:
    1;

  users:
    Record<
      string,
      PasswordOverride
    >;
};


const resetStates =
  new Map<
    string,
    ResetState
  >();


const overridePath =
  fileURLToPath(
    new URL(
      "../../data/auth-password-overrides.json",
      import.meta.url,
    ),
  );


function normalizedEmail(
  value:
    string,
) {
  return value
    .trim()
    .toLowerCase();
}


function otpHash(
  email:
    string,

  otp:
    string,
) {
  return createHmac(
    "sha256",
    authConfig.secret,
  )
    .update(
      `${normalizedEmail(email)}:${otp}`,
      "utf8",
    )
    .digest(
      "hex",
    );
}


async function readStore():
Promise<PasswordOverrideStore> {
  try {
    const raw =
      await readFile(
        overridePath,
        "utf8",
      );

    const parsed =
      JSON.parse(
        raw,
      ) as Partial<PasswordOverrideStore>;

    return {
      version:
        1,

      users:
        parsed.users
        && typeof parsed.users === "object"
          ? parsed.users
          : {},
    };

  } catch (
    error:
      unknown
  ) {
    const code =
      (
        error as {
          code?: string;
        }
      )?.code;

    if (
      code === "ENOENT"
    ) {
      return {
        version:
          1,

        users:
          {},
      };
    }

    throw error;
  }
}


async function writeStore(
  store:
    PasswordOverrideStore,
) {
  await mkdir(
    dirname(
      overridePath,
    ),
    {
      recursive:
        true,
    },
  );

  const temporary =
    `${overridePath}.tmp`;

  await writeFile(
    temporary,
    JSON.stringify(
      store,
      null,
      2,
    ),
    {
      encoding:
        "utf8",

      mode:
        0o600,
    },
  );

  await rename(
    temporary,
    overridePath,
  );
}


export async function readPasswordOverride(
  userId:
    string,
): Promise<PasswordOverride | null> {
  const store =
    await readStore();

  const override =
    store.users[
      userId
    ];

  if (
    !override
    || !override.passwordHash
    || !override.passwordChangedAt
  ) {
    return null;
  }

  return override;
}


export async function requestAdminPasswordReset(
  email:
    string,
): Promise<void> {
  const normalized =
    normalizedEmail(
      email,
    );

  /*
   * Respuesta exterior siempre genérica.
   * Sólo este admin tiene recuperación habilitada.
   */
  if (
    normalized
    !== ADMIN_EMAIL
  ) {
    return;
  }


  const user =
    authConfig.users.find(
      (
        candidate,
      ) =>
        candidate.active
        && candidate.email
          .toLowerCase()
          === ADMIN_EMAIL
        && candidate.companyId
          === ADMIN_COMPANY
        && candidate.role
          === "admin",
    );

  if (
    !user
  ) {
    return;
  }


  const previous =
    resetStates.get(
      normalized,
    );

  const now =
    Date.now();


  if (
    previous
    && now
      - previous.lastSentAt
      < OTP_COOLDOWN_MS
  ) {
    return;
  }


  const settings =
    await readCatalogMediaSettings(
      ADMIN_COMPANY,
    );

  const phone =
    user.phone
    ?? settings.ownerWhatsapp;


  if (
    !phone
  ) {
    throw new Error(
      "ADMIN_RESET_PHONE_NOT_CONFIGURED",
    );
  }


  const otp =
    randomInt(
      100000,
      1000000,
    )
      .toString();


  await sendWhatsappText({
    to:
      phone,

    text:
      [
        "Fulanitas - recuperación de acceso",
        "",
        `Tu código es: ${otp}`,
        "",
        "Vence en 10 minutos y sólo puede usarse una vez.",
        "Si no solicitaste el cambio, ignorá este mensaje.",
      ].join(
        "\n",
      ),
  });


  resetStates.set(
    normalized,
    {
      hash:
        otpHash(
          normalized,
          otp,
        ),

      expiresAt:
        now
        + OTP_TTL_MS,

      attempts:
        0,

      lastSentAt:
        now,
    },
  );
}


export async function confirmAdminPasswordReset(
  input: {
    email:
      string;

    otp:
      string;

    newPassword:
      string;
  },
): Promise<boolean> {
  const email =
    normalizedEmail(
      input.email,
    );


  if (
    email !== ADMIN_EMAIL
  ) {
    return false;
  }


  const user =
    authConfig.users.find(
      (
        candidate,
      ) =>
        candidate.active
        && candidate.email
          .toLowerCase()
          === ADMIN_EMAIL
        && candidate.companyId
          === ADMIN_COMPANY
        && candidate.role
          === "admin",
    );


  if (
    !user
  ) {
    return false;
  }


  const state =
    resetStates.get(
      email,
    );


  if (
    !state
  ) {
    return false;
  }


  if (
    Date.now()
    > state.expiresAt
  ) {
    resetStates.delete(
      email,
    );

    return false;
  }


  if (
    state.attempts
    >= MAX_ATTEMPTS
  ) {
    resetStates.delete(
      email,
    );

    return false;
  }


  const suppliedHash =
    otpHash(
      email,
      input.otp,
    );


  if (
    suppliedHash
    !== state.hash
  ) {
    state.attempts += 1;

    if (
      state.attempts
      >= MAX_ATTEMPTS
    ) {
      resetStates.delete(
        email,
      );
    } else {
      resetStates.set(
        email,
        state,
      );
    }

    return false;
  }


  const passwordHash =
    await bcrypt.hash(
      input.newPassword,
      12,
    );


  const store =
    await readStore();


  store.users[
    user.id
  ] = {
    passwordHash,

    passwordChangedAt:
      new Date()
        .toISOString(),
  };


  await writeStore(
    store,
  );


  resetStates.delete(
    email,
  );


  return true;
}
