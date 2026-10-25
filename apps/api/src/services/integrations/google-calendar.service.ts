import {
  readIntegrationSecrets,
} from "./integration-secrets.repository.js";


const TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const CALENDAR_API =
  "https://www.googleapis.com/calendar/v3";


export type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  primary?: boolean;
  accessRole?: string;
  timeZone?: string;
};


type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};


async function config() {
  const integrations =
    await readIntegrationSecrets();

  return integrations
    .google_calendar;
}


async function tokenRequest(
  params: URLSearchParams,
): Promise<TokenResponse> {
  const response =
    await fetch(
      TOKEN_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          params.toString(),
      },
    );

  const body =
    await response
      .json()
      .catch(
        () => ({}),
      ) as TokenResponse;

  if (
    !response.ok
    || !body.access_token
  ) {
    throw new Error(
      body.error_description
      || body.error
      || "GOOGLE_OAUTH_TOKEN_ERROR",
    );
  }

  return body;
}


export async function exchangeGoogleAuthorizationCode(
  code: string,
  redirectUri: string,
) {
  const current =
    await config();

  if (
    !current.clientId
    || !current.clientSecret
  ) {
    throw new Error(
      "GOOGLE_CALENDAR_NOT_CONFIGURED",
    );
  }

  return tokenRequest(
    new URLSearchParams({
      client_id:
        current.clientId,

      client_secret:
        current.clientSecret,

      code,

      grant_type:
        "authorization_code",

      redirect_uri:
        redirectUri,
    }),
  );
}


export async function getGoogleAccessToken() {
  const current =
    await config();

  if (
    !current.clientId
    || !current.clientSecret
    || !current.refreshToken
  ) {
    throw new Error(
      "GOOGLE_CALENDAR_NOT_CONNECTED",
    );
  }

  const token =
    await tokenRequest(
      new URLSearchParams({
        client_id:
          current.clientId,

        client_secret:
          current.clientSecret,

        refresh_token:
          current.refreshToken,

        grant_type:
          "refresh_token",
      }),
    );

  return token.access_token as string;
}


async function googleRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken =
    await getGoogleAccessToken();

  const response =
    await fetch(
      `${CALENDAR_API}${path}`,
      {
        ...init,

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          ...init.headers,
        },
      },
    );

  const text =
    await response.text();

  const body =
    text
      ? JSON.parse(text)
      : null;

  if (!response.ok) {
    const message =
      body?.error?.message
      || `GOOGLE_CALENDAR_HTTP_${response.status}`;

    throw new Error(
      message,
    );
  }

  return body as T;
}


export async function listGoogleCalendars() {
  const result =
    await googleRequest<{
      items?: GoogleCalendarListItem[];
    }>(
      "/users/me/calendarList?minAccessRole=writer",
    );

  return result.items ?? [];
}


export async function listGoogleCalendarEvents(
  input: {
    timeMin: string;
    timeMax?: string;
    maxResults?: number;
  },
) {
  const current =
    await config();

  const calendarId =
    current.calendarId
    || "primary";

  const params =
    new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: input.timeMin,
      maxResults:
        String(
          input.maxResults
          ?? 100,
        ),
    });

  if (input.timeMax) {
    params.set(
      "timeMax",
      input.timeMax,
    );
  }

  return googleRequest<{
    items?: Array<
      Record<string, unknown>
    >;
  }>(
    `/calendars/${
      encodeURIComponent(
        calendarId,
      )
    }/events?${params.toString()}`,
  );
}


function nextDate(
  date: string,
) {
  const parsed =
    new Date(
      `${date}T00:00:00Z`,
    );

  parsed.setUTCDate(
    parsed.getUTCDate() + 1,
  );

  return parsed
    .toISOString()
    .slice(0, 10);
}


function addMinutes(
  date: string,
  time: string,
  minutes: number,
) {
  const normalized =
    time.slice(0, 8);

  const parsed =
    new Date(
      `${date}T${normalized}Z`,
    );

  parsed.setUTCMinutes(
    parsed.getUTCMinutes()
    + minutes,
  );

  return parsed
    .toISOString()
    .slice(0, 19);
}


export async function syncCrmEventToGoogle(
  input: {
    event: Record<
      string,
      unknown
    >;

    customerName?: string | null;
  },
) {
  const current =
    await config();

  const event =
    input.event;

  const eventDate =
    String(
      event.event_date
      ?? "",
    );

  if (!eventDate) {
    throw new Error(
      "EVENT_DATE_REQUIRED_FOR_GOOGLE_CALENDAR",
    );
  }

  const timeZone =
    current.timeZone
    || "Europe/Madrid";

  const startTime =
    event.start_time
      ? String(
          event.start_time,
        )
      : "";

  const endTime =
    event.end_time
      ? String(
          event.end_time,
        )
      : "";

  const start =
    startTime
      ? {
          dateTime:
            `${eventDate}T${startTime.slice(0, 8)}`,

          timeZone,
        }
      : {
          date:
            eventDate,
        };

  const end =
    startTime
      ? {
          dateTime:
            endTime
              ? `${eventDate}T${endTime.slice(0, 8)}`
              : addMinutes(
                  eventDate,
                  startTime,
                  120,
                ),

          timeZone,
        }
      : {
          date:
            nextDate(
              eventDate,
            ),
        };

  const location =
    [
      event.venue_name,
      event.venue_address,
      event.city,
      event.province,
    ]
      .filter(Boolean)
      .map(String)
      .join(", ");

  const description =
    [
      input.customerName
        ? `Cliente: ${input.customerName}`
        : null,

      event.event_type
        ? `Tipo: ${String(event.event_type)}`
        : null,

      event.guest_count
        ? `Invitados: ${String(event.guest_count)}`
        : null,

      event.customer_request
        ? `Solicitud: ${String(event.customer_request)}`
        : null,

      event.notes
        ? `Notas: ${String(event.notes)}`
        : null,

      "",
      "Sincronizado desde Eventos Mediterráneo.",
    ]
      .filter(
        (value) =>
          value !== null,
      )
      .join("\n");

  const payload = {
    summary:
      String(
        event.title
        ?? "Evento",
      ),

    description,

    location:
      location || undefined,

    start,

    end,

    extendedProperties: {
      private: {
        crm_event_id:
          String(event.id),

        eventos_company_id:
          String(
            event.company_id,
          ),
      },
    },
  };

  const calendarId =
    current.calendarId
    || "primary";

  const existingEventId =
    event.google_calendar_event_id
      ? String(
          event.google_calendar_event_id,
        )
      : "";

  if (existingEventId) {
    return googleRequest<
      Record<string, unknown>
    >(
      `/calendars/${
        encodeURIComponent(
          calendarId,
        )
      }/events/${
        encodeURIComponent(
          existingEventId,
        )
      }?sendUpdates=none`,
      {
        method: "PATCH",
        body:
          JSON.stringify(
            payload,
          ),
      },
    );
  }

  return googleRequest<
    Record<string, unknown>
  >(
    `/calendars/${
      encodeURIComponent(
        calendarId,
      )
    }/events?sendUpdates=none`,
    {
      method: "POST",
      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}


export async function deleteGoogleCalendarEvent(
  eventId: string,
  calendarId?: string | null,
) {
  const current =
    await config();

  const selected =
    calendarId
    || current.calendarId
    || "primary";

  const accessToken =
    await getGoogleAccessToken();

  const response =
    await fetch(
      `${CALENDAR_API}/calendars/${
        encodeURIComponent(
          selected,
        )
      }/events/${
        encodeURIComponent(
          eventId,
        )
      }`,
      {
        method: "DELETE",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    );

  if (
    response.status === 404
    || response.status === 410
  ) {
    return;
  }

  if (!response.ok) {
    throw new Error(
      `GOOGLE_CALENDAR_DELETE_${response.status}`,
    );
  }
}
