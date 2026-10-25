import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";


type Row =
  Record<string, any>;


const COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID
  || "eventos-mediterraneo";


const APPLY =
  process.argv.includes(
    "--apply",
  );


const TARGETS = [
  {
    id:
      "25cd5acd-ffe2-4bc8-8c17-c0d0f0e420a1",

    key:
      "fosati",

    providerPatch: {
      name:
        "Fosati",

      contact_name:
        "Alejandro",

      phone:
        "+34629652431",

      website:
        "https://www.fosati.com",
    },

    providerType:
      "sound_stage_provider",

    categories: [
      "sound",
      "stage",
      "event_equipment",
    ],

    notes: [
      "Clasificación verificada directamente contra captura de contacto de Google Drive.",
      "Contacto: Alejandro, Alboraya.",
      "Empresa asociada a sonido y escenario.",
      "Teléfono verificado: +34 629 65 24 31.",
      "Web visible en fuente: www.fosati.com.",
      "La denominación histórica 'Fosati Sillas' estaba mal clasificada.",
    ],

    source: {
      folder_id:
        "1mB33Wy8v0fAkIhKFJvcVc9QWiNSRVrrH",

      file_ids: [
        "1MW9ZRanI1a19mOf5oWBV8DC-oKSq71Ig",
      ],
    },
  },


  {
    id:
      "eeeb24ea-a32d-4c41-889d-59ec2d72799d",

    key:
      "ruben-sillas",

    providerPatch: {
      name:
        "Ruben Sillas Castellón",

      city:
        "Castellón",
    },

    providerType:
      "furniture_provider",

    categories: [
      "chairs",
      "furniture",
      "chair_rental",
    ],

    notes: [
      "Proveedor de alquiler de sillas verificado desde Google Drive.",
      "Silla de plástico blanca documentada a 1 €.",
      "Silla plegable documentada a 2,50 €.",
      "Transporte en día laborable documentado a 80 €.",
      "Transporte en fin de semana documentado a 120 €.",
      "Entrega y recogida incluidas según documento.",
    ],

    commercialConditions: {
      white_plastic_chair:
        1,

      folding_chair:
        2.5,

      weekday_transport:
        80,

      weekend_transport:
        120,

      delivery_and_collection_included:
        true,
    },

    source: {
      folder_id:
        "1ojPyPOmieXyK1-dVIsLtdX4tGHXwG65B",

      file_ids: [
        "1z90e_7MLScCZXjdlg8MjlFn6qF7TmtmmIL1nqDi5Xf4",
      ],
    },
  },
];


function enc(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}


function appendNotes(
  oldValue: unknown,
  notes: string[],
) {
  const old =
    String(
      oldValue
      || "",
    ).trim();


  const missing =
    notes.filter(
      note =>
        !old.includes(
          note,
        ),
    );


  if (
    !missing.length
  ) {
    return old;
  }


  const block =
    [
      "[Drive verificado 2026-09-29]",
      ...missing,
    ].join(
      "\n",
    );


  return old
    ? `${old}\n\n${block}`
    : block;
}


async function main() {
  const integrations =
    (
      await readIntegrationSecrets()
    ) as any;


  const supabase =
    integrations?.supabase;


  if (
    !supabase?.url
    ||
    !supabase?.serviceRoleKey
  ) {
    throw new Error(
      "SUPABASE_INTEGRATION_MISSING",
    );
  }


  process.env.SUPABASE_URL =
    String(
      supabase.url,
    );

  process.env.SUPABASE_SERVICE_ROLE_KEY =
    String(
      supabase.serviceRoleKey,
    );


  console.log(
    `MODE=${APPLY ? "APPLY" : "DRY_RUN"}`,
  );


  let updated =
    0;

  let histories =
    0;

  let failed =
    0;


  for (
    const target
    of TARGETS
  ) {
    try {
      const providers =
        await supabaseRequest<
          Row[]
        >({
          table:
            "crm_providers",

          query:
            `?select=*&id=eq.${enc(
              target.id,
            )}&company_id=eq.${enc(
              COMPANY_ID,
            )}&limit=1`,
        });


      if (
        providers.length !== 1
      ) {
        throw new Error(
          `PROVIDER_NOT_UNIQUE_${target.key}_${providers.length}`,
        );
      }


      const provider =
        providers[0];


      const profiles =
        await supabaseRequest<
          Row[]
        >({
          table:
            "crm_provider_profiles",

          query:
            `?select=*&provider_id=eq.${enc(
              target.id,
            )}&company_id=eq.${enc(
              COMPANY_ID,
            )}&limit=1`,
        });


      if (
        profiles.length !== 1
      ) {
        throw new Error(
          `PROFILE_NOT_UNIQUE_${target.key}_${profiles.length}`,
        );
      }


      const profile =
        profiles[0];


      const providerPatch:
        Row = {};


      for (
        const [
          key,
          value,
        ]
        of Object.entries(
          target.providerPatch,
        )
      ) {
        if (
          Object.prototype.hasOwnProperty.call(
            provider,
            key,
          )
        ) {
          providerPatch[key] =
            value;
        }
      }


      const profilePatch:
        Row = {};


      if (
        Object.prototype.hasOwnProperty.call(
          profile,
          "provider_type",
        )
      ) {
        profilePatch.provider_type =
          target.providerType;
      }


      if (
        Object.prototype.hasOwnProperty.call(
          profile,
          "service_categories",
        )
      ) {
        profilePatch.service_categories =
          target.categories;
      }


      if (
        Object.prototype.hasOwnProperty.call(
          profile,
          "factual_notes",
        )
      ) {
        profilePatch.factual_notes =
          appendNotes(
            profile.factual_notes,
            target.notes,
          );
      }


      if (
        target.commercialConditions
        &&
        Object.prototype.hasOwnProperty.call(
          profile,
          "commercial_conditions",
        )
      ) {
        profilePatch.commercial_conditions = {
          ...(
            profile.commercial_conditions
            &&
            typeof profile.commercial_conditions
              === "object"
              ? profile.commercial_conditions
              : {}
          ),

          ...target.commercialConditions,
        };
      }


      if (
        Object.prototype.hasOwnProperty.call(
          profile,
          "source_metadata",
        )
      ) {
        const current =
          profile.source_metadata
          &&
          typeof profile.source_metadata
            === "object"
            ? profile.source_metadata
            : {};


        profilePatch.source_metadata = {
          ...current,

          verified_drive_sync: {
            verified_at:
              "2026-09-29",

            folder_id:
              target.source.folder_id,

            file_ids:
              target.source.file_ids,

            verification:
              "Direct review against original Google Drive source.",
          },
        };
      }


      console.log("");
      console.log(
        `===== ${target.key} =====`,
      );

      console.log(
        `ID=${target.id}`,
      );

      console.log(
        `CURRENT_NAME=${provider.name}`,
      );

      console.log(
        "PROVIDER_PATCH=",
        JSON.stringify(
          providerPatch,
        ),
      );

      console.log(
        "PROFILE_PATCH=",
        JSON.stringify(
          profilePatch,
        ),
      );


      if (
        !APPLY
      ) {
        continue;
      }


      if (
        Object.keys(
          providerPatch,
        ).length
      ) {
        await supabaseRequest({
          table:
            "crm_providers",

          method:
            "PATCH",

          query:
            `?id=eq.${enc(
              target.id,
            )}`,

          body:
            providerPatch,
        });
      }


      await supabaseRequest({
        table:
          "crm_provider_profiles",

        method:
          "PATCH",

        query:
          `?provider_id=eq.${enc(
            target.id,
          )}`,

        body:
          profilePatch,
      });


      const title =
        `Drive verificado: ${target.key}`;


      const oldHistory =
        await supabaseRequest<
          Row[]
        >({
          table:
            "crm_entity_history",

          query:
            [
              "?select=id",
              `company_id=eq.${enc(
                COMPANY_ID,
              )}`,
              `provider_id=eq.${enc(
                target.id,
              )}`,
              `history_type=eq.drive_verified_enrichment`,
              `title=eq.${enc(
                title,
              )}`,
              "limit=1",
            ].join(
              "&",
            ),
        });


      if (
        oldHistory.length === 0
      ) {
        await supabaseRequest({
          table:
            "crm_entity_history",

          method:
            "POST",

          body: {
            company_id:
              COMPANY_ID,

            entity_type:
              "provider",

            provider_id:
              target.id,

            history_type:
              "drive_verified_enrichment",

            title,

            description:
              "Datos corregidos y verificados directamente contra la fuente original de Google Drive.",

            confidence:
              "source",

            metadata: {
              source:
                "google_drive_verified",

              folder_id:
                target.source.folder_id,

              file_ids:
                target.source.file_ids,

              provider_patch:
                providerPatch,

              categories:
                target.categories,
            },
          },
        });

        histories++;
      }


      updated++;

      console.log(
        `UPDATED_OK=${target.key}`,
      );
    }
    catch (
      error
    ) {
      failed++;

      console.error(
        `FAILED_${target.key}=`,
        error,
      );
    }
  }


  console.log("");
  console.log(
    `UPDATED=${updated}`,
  );

  console.log(
    `HISTORY_CREATED=${histories}`,
  );

  console.log(
    `FAILED=${failed}`,
  );
}


await main();
