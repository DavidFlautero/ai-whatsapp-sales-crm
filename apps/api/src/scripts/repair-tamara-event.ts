import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";


type Row =
  Record<string, unknown>;


function enc(
  value: unknown,
) {
  return encodeURIComponent(
    String(
      value,
    ),
  );
}


function norm(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
}


function num(
  value: unknown,
) {
  const n =
    Number(
      value,
    );

  return Number.isFinite(
    n,
  )
    ? n
    : null;
}


const integrations =
  await readIntegrationSecrets() as any;


if (
  integrations?.supabase?.url
) {
  process.env.SUPABASE_URL =
    integrations.supabase.url;
}


if (
  integrations?.supabase
    ?.serviceRoleKey
) {
  process.env
    .SUPABASE_SERVICE_ROLE_KEY =
      integrations.supabase
        .serviceRoleKey;
}


const company =
  process.env.DEFAULT_COMPANY_ID
  ||
  "eventos-mediterraneo";


console.log(
  `COMPANY_ID=${company}`
);


/*
 * Buscar el evento que acabamos de intentar crear.
 *
 * No usamos solamente "Tamara" porque crm_events
 * puede almacenar customer_id y no el nombre del cliente.
 */
const events =
  await supabaseRequest<Row[]>({
    table:
      "crm_events",

    query:
      `?select=*&company_id=eq.${enc(company)}`
      + `&event_date=eq.2026-10-08`
      + `&order=created_at.desc`
      + `&limit=30`,
  });


console.log(
  `EVENTS_ON_DATE=${events.length}`
);


const candidates:
  Row[] = [];


for (
  const event
  of events
) {
  const guests =
    num(
      event.guest_count,
    );

  const budget =
    num(
      event.target_budget,
    );

  const city =
    norm(
      event.city,
    );

  const type =
    norm(
      event.event_type,
    );


  const guestMatch =
    guests === 20;

  const budgetMatch =
    budget === 500;

  const cityMatch =
    city.includes(
      "valencia",
    );

  const typeMatch =
    type.includes(
      "cumple",
    );


  console.log(
    "EVENT_CANDIDATE",
    JSON.stringify(
      {
        id:
          event.id,

        event_type:
          event.event_type,

        event_date:
          event.event_date,

        guest_count:
          event.guest_count,

        city:
          event.city,

        target_budget:
          event.target_budget,

        customer_id:
          event.customer_id,

        created_at:
          event.created_at,

        exact:
          guestMatch
          &&
          budgetMatch
          &&
          cityMatch
          &&
          typeMatch,
      },
    ),
  );


  if (
    guestMatch
    &&
    budgetMatch
    &&
    cityMatch
    &&
    typeMatch
  ) {
    candidates.push(
      event,
    );
  }
}


console.log(
  `EXACT_MATCH_COUNT=${candidates.length}`
);


if (
  candidates.length !== 1
) {
  console.log(
    "REPAIR_SKIPPED=1"
  );

  console.log(
    "REASON=NECESITO_UN_SOLO_EVENTO_COINCIDENTE"
  );

  /*
   * No fallamos el proceso ni tocamos nada:
   * evitamos crear o modificar un evento ambiguo.
   */
}
else {

  const event =
    candidates[0];

  const eventId =
    String(
      event.id,
    );


  console.log(
    `REPAIR_EVENT_ID=${eventId}`
  );


  const categories =
    await supabaseRequest<Row[]>({
      table:
        "crm_service_categories",

      query:
        `?select=id,name,active`
        + `&company_id=eq.${enc(company)}`
        + `&active=eq.true`,
    });


  const requiredNames = [
    "Espacios / Chalets",
    "DJ",
    "Sonido",
  ];


  let created =
    0;

  let reused =
    0;

  let failed =
    0;


  for (
    const name
    of requiredNames
  ) {

    const category =
      categories.find(
        item =>
          norm(
            item.name,
          )
          ===
          norm(
            name,
          ),
      );


    if (
      !category
    ) {
      console.log(
        `CATEGORY_NOT_FOUND=${name}`
      );

      failed += 1;

      continue;
    }


    const categoryId =
      String(
        category.id,
      );


    const existing =
      await supabaseRequest<Row[]>({
        table:
          "crm_event_requirements",

        query:
          `?select=*`
          + `&company_id=eq.${enc(company)}`
          + `&event_id=eq.${enc(eventId)}`
          + `&category_id=eq.${enc(categoryId)}`
          + `&limit=1`,
      });


    if (
      existing[0]
    ) {

      const current =
        String(
          existing[0]
            .contract_status
          ?? "",
        );


      const valid =
        new Set([
          "not_required",
          "pending",
          "generated",
          "sent",
          "signed",
          "cancelled",
        ]);


      if (
        !valid.has(
          current,
        )
      ) {
        await supabaseRequest({
          table:
            "crm_event_requirements",

          method:
            "PATCH",

          query:
            `?id=eq.${enc(existing[0].id)}`
            + `&company_id=eq.${enc(company)}`,

          body: {
            contract_status:
              "not_required",
          },
        });


        console.log(
          `NORMALIZED_CONTRACT_STATUS=${name}`
        );
      }


      console.log(
        `REUSED_REQUIREMENT=${name}`
      );

      reused += 1;

      continue;
    }


    await supabaseRequest({
      table:
        "crm_event_requirements",

      method:
        "POST",

      body: {
        company_id:
          company,

        event_id:
          eventId,

        category_id:
          categoryId,

        status:
          "needed",

        service_status:
          "pending",

        contract_status:
          "not_required",

        is_required:
          true,

        requirement_text:
          null,

        quantity:
          1,

        budget_cap:
          null,

        priority:
          50,
      },
    });


    console.log(
      `CREATED_REQUIREMENT=${name}`
    );

    created += 1;
  }


  const finalRequirements =
    await supabaseRequest<Row[]>({
      table:
        "crm_event_requirements",

      query:
        `?select=id,category_id,status,service_status,contract_status`
        + `&company_id=eq.${enc(company)}`
        + `&event_id=eq.${enc(eventId)}`,
    });


  console.log();
  console.log(
    `REPAIR_CREATED=${created}`
  );

  console.log(
    `REPAIR_REUSED=${reused}`
  );

  console.log(
    `REPAIR_FAILED=${failed}`
  );

  console.log(
    `FINAL_REQUIREMENT_COUNT=${finalRequirements.length}`
  );

  console.log(
    `EVENT_PATH=/crm/eventos/${eventId}`
  );


  for (
    const requirement
    of finalRequirements
  ) {
    console.log(
      "FINAL_REQUIREMENT",
      JSON.stringify(
        requirement,
      ),
    );
  }
}
