import {
  readIntegrationSecrets,
} from "../integrations/integration-secrets.repository.js";


export type WhatsappBusinessProfile = {
  about?: string;
  address?: string;
  description?: string;
  email?: string;

  profile_picture_url?:
    string;

  websites?: string[];

  vertical?:
    string;

  messaging_product?:
    string;
};


export type UpdateWhatsappBusinessProfileInput = {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  websites?: string[];
  vertical?: string;
  profilePictureHandle?: string;
};


async function whatsappConfig() {
  const integrations =
    await readIntegrationSecrets();

  const whatsapp =
    integrations.whatsapp;

  const token =
    whatsapp.token
      ?.trim();

  const phoneNumberId =
    whatsapp.phoneNumberId
      ?.trim();

  const graphVersion =
    (
      whatsapp.graphVersion
      || "v25.0"
    ).replace(
      /^v?/,
      "v",
    );

  if (!token) {
    throw new Error(
      "WHATSAPP_TOKEN_NOT_CONFIGURED",
    );
  }

  if (!phoneNumberId) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID_NOT_CONFIGURED",
    );
  }

  return {
    token,
    phoneNumberId,
    graphVersion,
  };
}


export async function getWhatsappBusinessProfile():
Promise<WhatsappBusinessProfile | null> {
  const {
    token,
    phoneNumberId,
    graphVersion,
  } =
    await whatsappConfig();

  const fields = [
    "about",
    "address",
    "description",
    "email",
    "profile_picture_url",
    "websites",
    "vertical",
  ].join(",");

  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/whatsapp_business_profile?fields=${encodeURIComponent(fields)}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    );

  const payload =
    await response
      .json()
      .catch(
        () => ({}),
      ) as {
        data?: WhatsappBusinessProfile[];
        error?: {
          message?: string;
        };
      };

  if (!response.ok) {
    throw new Error(
      payload
        .error
        ?.message
      || "WHATSAPP_PROFILE_READ_FAILED",
    );
  }

  return payload.data?.[0]
    ?? null;
}


export async function updateWhatsappBusinessProfile(
  input: UpdateWhatsappBusinessProfileInput,
) {
  const {
    token,
    phoneNumberId,
    graphVersion,
  } =
    await whatsappConfig();

  const body:
    Record<string, unknown> = {
      messaging_product:
        "whatsapp",
    };

  if (
    input.about
    !== undefined
  ) {
    body.about =
      input.about
        .trim();
  }

  if (
    input.address
    !== undefined
  ) {
    body.address =
      input.address
        .trim();
  }

  if (
    input.description
    !== undefined
  ) {
    body.description =
      input.description
        .trim();
  }

  if (
    input.email
    !== undefined
  ) {
    body.email =
      input.email
        .trim();
  }

  if (
    input.websites
    !== undefined
  ) {
    body.websites =
      input.websites
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean)
        .slice(0, 2);
  }

  if (
    input.vertical
    !== undefined
  ) {
    body.vertical =
      input.vertical
        .trim();
  }

  if (
    input.profilePictureHandle
  ) {
    body.profile_picture_handle =
      input.profilePictureHandle;
  }

  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/whatsapp_business_profile`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            body,
          ),
      },
    );

  const payload =
    await response
      .json()
      .catch(
        () => ({}),
      );

  if (!response.ok) {
    const error =
      payload
      && typeof payload === "object"
      && "error" in payload
        ? (
            payload as {
              error?: {
                message?: string;
              };
            }
          )
            .error
            ?.message
        : null;

    throw new Error(
      error
      || "WHATSAPP_PROFILE_UPDATE_FAILED",
    );
  }

  return payload;
}


export type WhatsappPhoneIdentity = {
  id: string;
  verified_name?: string;
  display_phone_number?: string;
  quality_rating?: string;
  name_status?: string;
  new_name_status?: string;
};


export async function getWhatsappPhoneIdentity():
Promise<WhatsappPhoneIdentity | null> {
  const integrations =
    await readIntegrationSecrets();

  const whatsapp =
    integrations.whatsapp;

  const token =
    whatsapp.token?.trim();

  const businessAccountId =
    whatsapp.businessAccountId
      ?.trim();

  const phoneNumberId =
    whatsapp.phoneNumberId
      ?.trim();

  const graphVersion =
    (
      whatsapp.graphVersion
      || "v25.0"
    ).replace(
      /^v?/,
      "v",
    );

  if (
    !token
    || !businessAccountId
  ) {
    throw new Error(
      "WHATSAPP_WABA_NOT_CONFIGURED",
    );
  }

  const fields = [
    "id",
    "verified_name",
    "display_phone_number",
    "quality_rating",
    "name_status",
    "new_name_status",
  ].join(",");

  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${businessAccountId}/phone_numbers?fields=${encodeURIComponent(fields)}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    );

  const payload =
    await response
      .json()
      .catch(
        () => ({}),
      ) as {
        data?: WhatsappPhoneIdentity[];
        error?: {
          message?: string;
        };
      };

  if (!response.ok) {
    throw new Error(
      payload.error?.message
      || "WHATSAPP_PHONE_IDENTITY_FAILED",
    );
  }

  return (
    payload.data
      ?.find(
        (item) =>
          item.id
          === phoneNumberId,
      )
    ?? payload.data?.[0]
    ?? null
  );
}


export async function updateWhatsappProfilePicture(
  input: {
    buffer: Buffer;
    mimeType: string;
    filename?: string;
  },
): Promise<{
  success: boolean;
  handle?: string;
  profile?: WhatsappBusinessProfile | null;
}> {
  const integrations =
    await readIntegrationSecrets();

  const whatsapp =
    integrations.whatsapp;

  const token =
    whatsapp.token?.trim();

  const phoneNumberId =
    whatsapp.phoneNumberId?.trim();

  const businessAccountId =
    whatsapp.businessAccountId?.trim();

  const appId =
    process.env.WHATSAPP_APP_ID
      ?.trim();

  const graphVersion =
    (
      whatsapp.graphVersion
      || "v25.0"
    ).replace(
      /^v?/,
      "v",
    );

  if (
    !token
    || !phoneNumberId
    || !businessAccountId
    || !appId
  ) {
    throw new Error(
      "WHATSAPP_CONFIGURATION_INCOMPLETE",
    );
  }

  /*
   * Meta usa Resumable Upload para obtener
   * un file handle. Ese handle después se
   * asigna al business profile.
   */

  const createSessionResponse =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${appId}/uploads`
      + `?file_length=${input.buffer.length}`
      + `&file_type=${encodeURIComponent(input.mimeType)}`
      + `&access_token=${encodeURIComponent(token)}`,
      {
        method:
          "POST",
      },
    );

  const createSessionPayload =
    await createSessionResponse.json()
      .catch(
        () => ({}),
      ) as {
        id?: string;
        error?: {
          message?: string;
        };
      };

  if (
    !createSessionResponse.ok
    || !createSessionPayload.id
  ) {
    console.error(
      "[WHATSAPP PROFILE PICTURE SESSION ERROR]",
      {
        status:
          createSessionResponse.status,

        payload:
          createSessionPayload,
      },
    );

    throw new Error(
      createSessionPayload.error?.message
      || "WHATSAPP_PROFILE_PICTURE_SESSION_FAILED",
    );
  }

  const uploadResponse =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${createSessionPayload.id}`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `OAuth ${token}`,

          file_offset:
            "0",

          "Content-Type":
            "application/octet-stream",
        },

        body:
          new Uint8Array(
            input.buffer,
          ),
      },
    );

  const uploadPayload =
    await uploadResponse.json()
      .catch(
        () => ({}),
      ) as {
        h?: string;
        error?: {
          message?: string;
        };
      };

  if (
    !uploadResponse.ok
    || !uploadPayload.h
  ) {
    console.error(
      "[WHATSAPP PROFILE PICTURE UPLOAD ERROR]",
      {
        status:
          uploadResponse.status,

        payload:
          uploadPayload,
      },
    );

    throw new Error(
      uploadPayload.error?.message
      || "WHATSAPP_PROFILE_PICTURE_UPLOAD_FAILED",
    );
  }

  const handle =
    uploadPayload.h;

  const profileResponse =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/whatsapp_business_profile`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            messaging_product:
              "whatsapp",

            profile_picture_handle:
              handle,
          }),
      },
    );

  const profilePayload =
    await profileResponse.json()
      .catch(
        () => ({}),
      ) as {
        success?: boolean;
        error?: {
          message?: string;
        };
      };

  if (!profileResponse.ok) {
    console.error(
      "[WHATSAPP PROFILE PICTURE SET ERROR]",
      {
        status:
          profileResponse.status,

        payload:
          profilePayload,
      },
    );

    throw new Error(
      profilePayload.error?.message
      || "WHATSAPP_PROFILE_PICTURE_SET_FAILED",
    );
  }

  console.log(
    "[WHATSAPP PROFILE PICTURE UPDATED]",
    {
      phoneNumberId,
      success:
        profilePayload.success
        ?? true,
    },
  );

  /*
   * Volvemos a consultar Meta para que
   * frontend reciba la URL actualizada.
   */
  const profile =
    await getWhatsappBusinessProfile();

  return {
    success:
      profilePayload.success
      ?? true,

    handle,

    profile,
  };
}
