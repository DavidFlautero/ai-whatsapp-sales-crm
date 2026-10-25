import {
  redirect,
} from "next/navigation";

import {
  EventCRMClient,
} from "../../EventCRMClient";


type PageProps = {
  params:
    Promise<{
      eventId: string;
    }>;

  searchParams:
    Promise<{
      view?:
        string
        | string[];

      event?:
        string
        | string[];
    }>;
};


function first(
  value:
    string
    | string[]
    | undefined,
) {
  return Array.isArray(
    value,
  )
    ? value[0]
    : value;
}


export default async function EventDetailPage({
  params,
  searchParams,
}: PageProps) {
  const {
    eventId,
  } =
    await params;


  const query =
    await searchParams;


  const view =
    first(
      query.view,
    );


  const queryEventId =
    first(
      query.event,
    );


  /*
   * Nos quedamos SIEMPRE en:
   *
   * /crm/eventos/<ID>
   *
   * Los parámetros sólo inicializan
   * EventCRMClient / EventWorkspace.
   *
   * Nunca volvemos a /crm general.
   */
  if (
    view !== "events"
    ||
    queryEventId !== eventId
  ) {
    redirect(
      `/crm/eventos/${encodeURIComponent(
        eventId,
      )}`
      +
      `?view=events&event=${encodeURIComponent(
        eventId,
      )}`,
    );
  }


  return (
    <EventCRMClient />
  );
}
