import type {
  Request,
  Response,
} from "express";

import {
  createVoiceCallSchema,
  transitionVoiceCallSchema,
  voiceTakeoverSchema,
} from "./voice-call.schema.js";

import {
  getVoiceCallDetail,
  getVoiceCalls,
} from "./voice-call-detail.service.js";

import {
  startVoiceCall,
} from "./voice-call-start.service.js";

import {
  takeOverVoiceCall,
} from "./voice-call-takeover.service.js";

import {
  transitionVoiceCall,
} from "./voice-call-transition.service.js";

import {
  respondVoiceError,
  voiceActorId,
  voiceCompanyId,
} from "./voice-http.js";

export async function showVoiceCalls(
  request: Request,
  response: Response,
) {
  try {
    const requestedLimit =
      Number(request.query.limit);

    const limit =
      Number.isFinite(requestedLimit)
        ? requestedLimit
        : 100;

    const calls =
      await getVoiceCalls(
        voiceCompanyId(request),
        limit,
      );

    return response.json({
      ok: true,
      calls,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function showVoiceCall(
  request: Request,
  response: Response,
) {
  try {
    const detail =
      await getVoiceCallDetail(
        voiceCompanyId(request),
        String(request.params.callId),
      );

    return response.json({
      ok: true,
      ...detail,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function createVoiceCall(
  request: Request,
  response: Response,
) {
  try {
    const input =
      createVoiceCallSchema
        .parse(request.body);

    const call =
      await startVoiceCall(
        voiceCompanyId(request),
        input,
      );

    return response
      .status(201)
      .json({
        ok: true,
        call,
      });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function changeVoiceCallStatus(
  request: Request,
  response: Response,
) {
  try {
    const input =
      transitionVoiceCallSchema
        .parse(request.body);

    const call =
      await transitionVoiceCall(
        voiceCompanyId(request),
        String(request.params.callId),
        {
          ...input,
          actor_id:
            voiceActorId(request),
        },
      );

    return response.json({
      ok: true,
      call,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function takeVoiceCall(
  request: Request,
  response: Response,
) {
  try {
    const input =
      voiceTakeoverSchema
        .parse(request.body);

    const call =
      await takeOverVoiceCall(
        voiceCompanyId(request),
        String(request.params.callId),
        voiceActorId(request),
        input,
      );

    return response.json({
      ok: true,
      call,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}
