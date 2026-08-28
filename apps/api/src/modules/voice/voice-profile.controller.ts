import type {
  Request,
  Response,
} from "express";

import {
  voiceProfileUpdateSchema,
  voiceRouteInputSchema,
} from "./voice-profile.schema.js";

import {
  configureVoiceProfile,
  configureVoiceRoute,
  getVoiceProfile,
  getVoiceRoutes,
} from "./voice-profile.service.js";

import {
  respondVoiceError,
  voiceCompanyId,
} from "./voice-http.js";

export async function showVoiceProfile(
  request: Request,
  response: Response,
) {
  try {
    const profile =
      await getVoiceProfile(
        voiceCompanyId(request),
      );

    return response.json({
      ok: true,
      profile,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function updateVoiceProfile(
  request: Request,
  response: Response,
) {
  try {
    const input =
      voiceProfileUpdateSchema
        .parse(request.body);

    const profile =
      await configureVoiceProfile(
        voiceCompanyId(request),
        input,
      );

    return response.json({
      ok: true,
      profile,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function showVoiceRoutes(
  request: Request,
  response: Response,
) {
  try {
    const routes =
      await getVoiceRoutes(
        voiceCompanyId(request),
      );

    return response.json({
      ok: true,
      routes,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function createVoiceRoute(
  request: Request,
  response: Response,
) {
  try {
    const input =
      voiceRouteInputSchema
        .parse(request.body);

    const route =
      await configureVoiceRoute(
        voiceCompanyId(request),
        input,
      );

    return response
      .status(201)
      .json({
        ok: true,
        route,
      });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}

export async function updateVoiceRoute(
  request: Request,
  response: Response,
) {
  try {
    const input =
      voiceRouteInputSchema
        .parse(request.body);

    const route =
      await configureVoiceRoute(
        voiceCompanyId(request),
        input,
        String(request.params.routeId),
      );

    return response.json({
      ok: true,
      route,
    });
  } catch (error) {
    return respondVoiceError(
      error,
      response,
    );
  }
}
