import {
  isVoiceSupabaseConfigured,
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

import type {
  VoiceProfile,
  VoiceRoute,
} from "./voice.types.js";

const memoryProfiles =
  new Map<string, VoiceProfile>();

const memoryRoutes =
  new Map<string, VoiceRoute>();

function now(): string {
  return new Date().toISOString();
}

function routeKey(
  companyId: string,
  routeId: string,
): string {
  return `${companyId}:${routeId}`;
}

export async function findVoiceProfile(
  companyId: string,
): Promise<VoiceProfile | null> {
  if (!isVoiceSupabaseConfigured()) {
    return (
      memoryProfiles.get(companyId)
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      VoiceProfile[]
    >({
      table:
        "voice_profiles",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function saveVoiceProfile(
  profile: VoiceProfile,
): Promise<VoiceProfile> {
  if (!isVoiceSupabaseConfigured()) {
    const timestamp =
      now();

    const saved: VoiceProfile = {
      ...profile,
      id:
        profile.id
        ?? crypto.randomUUID(),
      created_at:
        profile.created_at
        ?? timestamp,
      updated_at:
        timestamp,
    };

    memoryProfiles.set(
      profile.company_id,
      saved,
    );

    return saved;
  }

  const rows =
    await supabaseRequest<
      VoiceProfile[]
    >({
      table:
        "voice_profiles",

      method:
        "POST",

      query:
        "?on_conflict=company_id",

      prefer:
        "resolution=merge-duplicates,"
        + "return=representation",

      body:
        [profile],
    });

  const saved =
    rows[0];

  if (!saved) {
    throw new Error(
      "VOICE_PROFILE_SAVE_FAILED",
    );
  }

  return saved;
}

export async function listVoiceRoutes(
  companyId: string,
): Promise<VoiceRoute[]> {
  if (!isVoiceSupabaseConfigured()) {
    return Array.from(
      memoryRoutes.values(),
    )
      .filter(
        (route) =>
          route.company_id
          === companyId,
      )
      .sort(
        (left, right) =>
          left.priority
          - right.priority,
      );
  }

  return supabaseRequest<
    VoiceRoute[]
  >({
    table:
      "voice_routes",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + "&select=*"
      + "&order=priority.asc,created_at.asc",
  });
}

export async function findVoiceRoute(
  companyId: string,
  routeId: string,
): Promise<VoiceRoute | null> {
  if (!isVoiceSupabaseConfigured()) {
    return (
      memoryRoutes.get(
        routeKey(
          companyId,
          routeId,
        ),
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      VoiceRoute[]
    >({
      table:
        "voice_routes",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(routeId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function saveVoiceRoute(
  route: VoiceRoute,
): Promise<VoiceRoute> {
  if (!isVoiceSupabaseConfigured()) {
    const timestamp =
      now();

    const saved: VoiceRoute = {
      ...route,
      id:
        route.id
        ?? crypto.randomUUID(),
      created_at:
        route.created_at
        ?? timestamp,
      updated_at:
        timestamp,
    };

    memoryRoutes.set(
      routeKey(
        saved.company_id,
        saved.id!,
      ),
      saved,
    );

    return saved;
  }

  if (route.id) {
    const changes: Partial<VoiceRoute> = {
      ...route,
    };

    delete changes.id;
    delete changes.company_id;
    delete changes.created_at;

    const rows =
      await supabaseRequest<
        VoiceRoute[]
      >({
        table:
          "voice_routes",

        method:
          "PATCH",

        query:
          `?company_id=eq.${encodeURIComponent(route.company_id)}`
          + `&id=eq.${encodeURIComponent(route.id)}`,

        body:
          changes,
      });

    const saved =
      rows[0];

    if (!saved) {
      throw new Error(
        "VOICE_ROUTE_NOT_FOUND",
      );
    }

    return saved;
  }

  const rows =
    await supabaseRequest<
      VoiceRoute[]
    >({
      table:
        "voice_routes",

      method:
        "POST",

      body:
        [route],
    });

  const saved =
    rows[0];

  if (!saved) {
    throw new Error(
      "VOICE_ROUTE_SAVE_FAILED",
    );
  }

  return saved;
}
