import type {
  Request,
  Response,
} from "express";

import {
  voiceEventInputSchema,
  voiceTranscriptInputSchema,
} from "./voice-call.schema.js";

import {
  allocateTranscriptSequence,
  registerTranscriptSegment,
  registerVoiceEvent,
} from "./voice-call-detail.service.js";

import {
  respondVoiceError,
  voiceActorId,
  voiceCompanyId,
} from "./voice-http.js";

export async function addVoiceCallEvent(
  request: Request,
  response: Response,
) {
  try {
    const input =
      voiceEventInputSchema
        .parse(request.body);

    const event =
      await registerVoiceEvent(
        voiceCompanyId(request),
        String(request.params.callId),
        voiceActorId(request),
        input,
      );

    return response
      .status(201)
      .json({
        ok: true,
        event,
      });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function addTranscriptSegment(
  request: Request,
  response: Response,
) {
  try {
    const input =
      voiceTranscriptInputSchema
        .parse(request.body);

    const segment =
      await registerTranscriptSegment(
        voiceCompanyId(request),
        String(request.params.callId),
        input,
      );

    return response
      .status(201)
      .json({
        ok: true,
        segment,
      });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function reserveTranscriptSequence(
  request: Request,
  response: Response,
) {
  try {
    const sequence =
      await allocateTranscriptSequence(
        voiceCompanyId(request),
        String(request.params.callId),
      );

    return response.json({
      ok: true,
      sequence,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}
