import {
  randomUUID,
} from "node:crypto";

import type {
  AccessActor,
} from "../authorization/index.js";

import type {
  TenantContext,
} from "../tenancy/index.js";

export type RequestSource =
  | "dashboard"
  | "whatsapp"
  | "worker"
  | "api"
  | "system";

export type RequestContext = {
  requestId: string;
  startedAt: string;

  actor: AccessActor;
  tenant: TenantContext;

  source: RequestSource;

  ipAddress:
    string | null;

  userAgent:
    string | null;
};

const REQUEST_ID_PATTERN =
  /^[A-Za-z0-9._:-]{8,128}$/;

export function normalizeRequestId(
  value:
    string
    | null
    | undefined,
): string {
  const candidate =
    value?.trim();

  if (
    candidate
    && REQUEST_ID_PATTERN.test(
      candidate,
    )
  ) {
    return candidate;
  }

  return randomUUID();
}

export function createRequestContext(
  input: Omit<
    RequestContext,
    "requestId"
    | "startedAt"
  > & {
    requestId?:
      string | null;
  },
): RequestContext {
  return {
    requestId:
      normalizeRequestId(
        input.requestId,
      ),

    startedAt:
      new Date()
        .toISOString(),

    actor:
      input.actor,

    tenant:
      input.tenant,

    source:
      input.source,

    ipAddress:
      input.ipAddress,

    userAgent:
      input.userAgent,
  };
}
