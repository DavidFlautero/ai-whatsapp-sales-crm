import {
  z,
} from "zod";

import {
  PRIVACY_CONSENT_STATUSES,
  PRIVACY_IDENTIFIER_KINDS,
  PRIVACY_IDENTITY_STATUSES,
  PRIVACY_ITEM_ACTIONS,
  PRIVACY_ITEM_STATUSES,
  PRIVACY_LAWFUL_BASES,
  PRIVACY_LEGAL_HOLD_STATUSES,
  PRIVACY_POLICY_STATUSES,
  PRIVACY_REQUEST_CHANNELS,
  PRIVACY_REQUEST_PRIORITIES,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  PRIVACY_SUBJECT_STATUSES,
} from "./privacy.types.js";

const shortText =
  z.string()
    .trim()
    .min(1)
    .max(200);

const nullableShortText =
  shortText
    .nullable();

const reasonCode =
  z.string()
    .trim()
    .regex(
      /^[a-z][a-z0-9_.-]{2,99}$/,
    );

const idempotencyKey =
  z.string()
    .trim()
    .min(8)
    .max(200)
    .regex(
      /^[A-Za-z0-9._:-]+$/,
    );

const isoDateTime =
  z.string()
    .datetime({
      offset: true,
    });

export const privacyJsonObjectSchema =
  z.record(
    z.string(),
    z.unknown(),
  );

export const privacyCompanyIdSchema =
  z.string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9][a-z0-9_-]{0,63}$/,
    );

export const privacySha256Schema =
  z.string()
    .regex(
      /^[0-9a-f]{64}$/,
    );

export const privacyUuidSchema =
  z.string()
    .uuid();

export const privacyIdentifierInputSchema =
  z.object({
    kind:
      z.enum(
        PRIVACY_IDENTIFIER_KINDS,
      ),

    value:
      z.string()
        .trim()
        .min(3)
        .max(320),

    contact_id:
      privacyUuidSchema
        .nullable()
        .optional(),
  })
    .strict();

export const privacyCreateRequestSchema =
  z.object({
    identifier:
      privacyIdentifierInputSchema,

    request_type:
      z.enum(
        PRIVACY_REQUEST_TYPES,
      ),

    source_channel:
      z.enum(
        PRIVACY_REQUEST_CHANNELS,
      ),

    priority:
      z.enum(
        PRIVACY_REQUEST_PRIORITIES,
      )
        .default("normal"),

    requested_scope:
      privacyJsonObjectSchema
        .default({}),

    idempotency_key:
      idempotencyKey
        .optional(),
  })
    .strict();

export const privacyVerifyIdentitySchema =
  z.object({
    status:
      z.enum(
        PRIVACY_IDENTITY_STATUSES,
      ),

    method:
      shortText
        .optional(),

    verification_proof:
      z.string()
        .min(6)
        .max(4096)
        .optional(),

    reason_code:
      reasonCode
        .optional(),
  })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.status === "verified"
          && !value.verification_proof
        ) {
          context.addIssue({
            code:
              "custom",

            path: [
              "verification_proof",
            ],

            message:
              "La verificación requiere evidencia.",
          });
        }

        if (
          value.status === "waived"
          && !value.reason_code
        ) {
          context.addIssue({
            code:
              "custom",

            path: [
              "reason_code",
            ],

            message:
              "La exención requiere un motivo.",
          });
        }
      },
    );

export const privacyTransitionSchema =
  z.object({
    target_status:
      z.enum(
        PRIVACY_REQUEST_STATUSES,
      ),

    expected_version:
      z.number()
        .int()
        .positive(),

    reason_code:
      reasonCode
        .optional(),

    decision_notes:
      z.string()
        .trim()
        .max(1000)
        .optional(),
  })
    .strict();

export const privacyConsentInputSchema =
  z.object({
    identifier:
      privacyIdentifierInputSchema,

    purpose_code:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .regex(
          /^[a-z][a-z0-9_.-]+$/,
        ),

    status:
      z.enum(
        PRIVACY_CONSENT_STATUSES,
      ),

    lawful_basis:
      z.enum(
        PRIVACY_LAWFUL_BASES,
      ),

    source_channel:
      z.union([
        z.enum(
          PRIVACY_REQUEST_CHANNELS,
        ),
        z.literal("import"),
      ]),

    notice_version:
      nullableShortText
        .optional(),

    evidence:
      privacyJsonObjectSchema
        .default({}),

    valid_from:
      isoDateTime
        .optional(),

    valid_until:
      isoDateTime
        .nullable()
        .optional(),

    withdrawal_reason_code:
      reasonCode
        .optional(),

    idempotency_key:
      idempotencyKey
        .optional(),
  })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.status === "withdrawn"
          && !value.withdrawal_reason_code
        ) {
          context.addIssue({
            code:
              "custom",

            path: [
              "withdrawal_reason_code",
            ],

            message:
              "La retirada requiere motivo.",
          });
        }

        if (
          value.valid_from
          && value.valid_until
          && (
            Date.parse(
              value.valid_until,
            )
            <= Date.parse(
              value.valid_from,
            )
          )
        ) {
          context.addIssue({
            code:
              "custom",

            path: [
              "valid_until",
            ],

            message:
              "La expiración debe ser posterior al inicio.",
          });
        }
      },
    );

export const privacyPolicyInputSchema =
  z.object({
    status:
      z.enum(
        PRIVACY_POLICY_STATUSES,
      )
        .optional(),

    controller_name:
      nullableShortText
        .optional(),

    controller_email:
      z.string()
        .email()
        .max(254)
        .nullable()
        .optional(),

    dpo_contact:
      nullableShortText
        .optional(),

    privacy_notice_url:
      z.string()
        .url()
        .max(1000)
        .nullable()
        .optional(),

    privacy_notice_version:
      nullableShortText
        .optional(),

    default_language:
      z.string()
        .regex(
          /^[a-z]{2}(-[A-Z]{2})?$/,
        )
        .optional(),

    data_residency_region:
      z.string()
        .trim()
        .min(2)
        .max(40)
        .optional(),

    conversations_retention_days:
      z.number()
        .int()
        .min(1)
        .max(3650)
        .optional(),

    messages_retention_days:
      z.number()
        .int()
        .min(1)
        .max(3650)
        .optional(),

    crm_profile_retention_days:
      z.number()
        .int()
        .min(1)
        .max(3650)
        .optional(),

    call_transcripts_retention_days:
      z.number()
        .int()
        .min(0)
        .max(3650)
        .optional(),

    voice_recordings_retention_days:
      z.number()
        .int()
        .min(0)
        .max(3650)
        .optional(),

    media_retention_days:
      z.number()
        .int()
        .min(0)
        .max(3650)
        .optional(),

    technical_logs_retention_days:
      z.number()
        .int()
        .min(1)
        .max(730)
        .optional(),

    export_expiration_hours:
      z.number()
        .int()
        .min(1)
        .max(168)
        .optional(),

    request_due_days:
      z.number()
        .int()
        .min(1)
        .max(90)
        .optional(),

    identity_verification_ttl_minutes:
      z.number()
        .int()
        .min(5)
        .max(1440)
        .optional(),

    automatic_retention_enabled:
      z.boolean()
        .optional(),

    automatic_erasure_enabled:
      z.boolean()
        .optional(),

    legal_hold_blocks_erasure:
      z.boolean()
        .optional(),

    lawful_basis_catalog:
      z.array(
        z.enum(
          PRIVACY_LAWFUL_BASES,
        ),
      )
        .max(
          PRIVACY_LAWFUL_BASES.length,
        )
        .optional(),

    policy_metadata:
      privacyJsonObjectSchema
        .optional(),
  })
    .strict()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "Debe proporcionar al menos un cambio.",
      },
    );

export const privacyLegalHoldInputSchema =
  z.object({
    subject_id:
      privacyUuidSchema,

    status:
      z.enum(
        PRIVACY_LEGAL_HOLD_STATUSES,
      )
        .default("active"),

    reason_code:
      reasonCode,

    authority_reference:
      z.string()
        .trim()
        .min(3)
        .max(1000)
        .optional(),

    scope:
      privacyJsonObjectSchema
        .default({}),

    starts_at:
      isoDateTime
        .optional(),

    expires_at:
      isoDateTime
        .nullable()
        .optional(),
  })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.starts_at
          && value.expires_at
          && (
            Date.parse(
              value.expires_at,
            )
            <= Date.parse(
              value.starts_at,
            )
          )
        ) {
          context.addIssue({
            code:
              "custom",

            path: [
              "expires_at",
            ],

            message:
              "La expiración debe ser posterior al inicio.",
          });
        }
      },
    );

export const privacyRequestItemInputSchema =
  z.object({
    store_code:
      z.string()
        .regex(
          /^[a-z][a-z0-9_]{1,79}$/,
        ),

    action_code:
      z.enum(
        PRIVACY_ITEM_ACTIONS,
      ),

    status:
      z.enum(
        PRIVACY_ITEM_STATUSES,
      )
        .default("pending"),
  })
    .strict();

export const privacyListQuerySchema =
  z.object({
    status:
      z.enum(
        PRIVACY_REQUEST_STATUSES,
      )
        .optional(),

    request_type:
      z.enum(
        PRIVACY_REQUEST_TYPES,
      )
        .optional(),

    subject_id:
      privacyUuidSchema
        .optional(),

    due_before:
      isoDateTime
        .optional(),

    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25),

    offset:
      z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .default(0),
  })
    .strict();

export const privacyIdParamSchema =
  z.object({
    id:
      privacyUuidSchema,
  })
    .strict();

export type PrivacyCreateRequestInput =
  z.infer<
    typeof privacyCreateRequestSchema
  >;

export type PrivacyVerifyIdentityInput =
  z.infer<
    typeof privacyVerifyIdentitySchema
  >;

export type PrivacyTransitionInput =
  z.infer<
    typeof privacyTransitionSchema
  >;

export type PrivacyConsentInput =
  z.infer<
    typeof privacyConsentInputSchema
  >;

export type PrivacyPolicyInput =
  z.infer<
    typeof privacyPolicyInputSchema
  >;

export type PrivacyLegalHoldInput =
  z.infer<
    typeof privacyLegalHoldInputSchema
  >;

export type PrivacyListQuery =
  z.infer<
    typeof privacyListQuerySchema
  >;
