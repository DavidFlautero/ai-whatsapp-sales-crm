import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";


import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

type DbRow =
  Record<string, unknown>;

const COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID;

if (!COMPANY_ID) {
  throw new Error(
    "DEFAULT_COMPANY_ID_NOT_SET",
  );
}

const DRY_RUN =
  process.argv.includes(
    "--dry-run",
  );

function enc(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}

function slugify(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function phone(
  value?: string,
) {
  if (!value) {
    return null;
  }

  return value
    .replace(
      /[^\d+]/g,
      "",
    );
}

type ProviderSeed = {
  key: string;
  name: string;
  phone?: string;
  city?: string;
  province?: string;
  type?: string;
  notes?: string;
  sourceFolderId?: string;
};

type VenueSeed = {
  key: string;
  providerKey: string;
  name: string;
  city?: string;
  province?: string;
  description?: string;
  address?: string;
  capacityMin?: number;
  capacityMax?: number;
  sleeping?: number;
  costFrom?: number;
  clientPriceFrom?: number;
  features?: string[];
  modes?: string[];
  eventsAllowed?: boolean;
  partiesAllowed?: boolean;
  sourceFolderId?: string;
};

type HistorySeed = {
  entity:
    | "provider"
    | "venue"
    | "general";
  entityKey: string;
  type: string;
  title: string;
  description: string;
  date?: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceFolderId?: string;
  sourceModifiedAt?: string;
  confidence?:
    | "source"
    | "derived"
    | "unverified"
    | "conflict";
  oldValue?: unknown;
  newValue?: unknown;
};

const providers:
  ProviderSeed[] = [
  {
    key: "tony",
    name: "Tony",
    phone: "+34678535098",
    city: "Godelleta",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1gy29OkZBQj1-uT6htuDptJS9pG9h8Ybp",
    notes:
      "Propietario de La Choza de Godelleta.",
  },
  {
    key: "marga",
    name: "Marga",
    phone: "+34667114424",
    city: "Picassent",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1AsOtUjC7VDRWIj8Gjuwz0ipcFCueZeFL",
  },
  {
    key: "daniel-alginet",
    name: "Daniel",
    phone: "+34630558345",
    city: "Alginet",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "19Y6KljuymlfxX6-EgQ_GvJsOW2_T9XN8",
  },
  {
    key: "pablo",
    name: "Pablo",
    phone: "+34604998534",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1ys3WfFI6G33M_ym8n_wI2cp7ZG1URSVa",
  },
  {
    key: "nuria",
    name: "Nuria",
    phone: "+34644642728",
    province: "Castellón",
    type: "owner",
    sourceFolderId:
      "1sCKIrEUWYHbV_DubBNGmhYjzQwdUON2D",
  },
  {
    key: "silvia",
    name: "Silvia",
    phone: "+34616518739",
    city: "Picassent",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1u-PG8adZ_iA0JevjGj46_O7FbvelSmY-",
  },
  {
    key: "juan-sole",
    name: "Juan Solé",
    city: "Llíria",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1fyubPign91_I25X_c-hbxIxiDOr0Z8eO",
  },
  {
    key: "luis",
    name: "Luis",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1dxCqpdf_Twgaqa1UWEJMI6-u1C1HmWHW",
  },
  {
    key: "niko",
    name: "Niko",
    city: "Silla",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "116arzwuvKr7sDIh9Icbe-NgzRSiFTHFp",
  },
  {
    key: "daniyil",
    name: "Daniyil",
    city: "Montserrat",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1c17bqqObWgEqOuzRuB5zqwVMHW3E_cCt",
  },
  {
    key: "mario",
    name: "Mario",
    province: "Valencia",
    type: "partner_owner",
    sourceFolderId:
      "1AdjL2WSfLEuzdIEtHLoCphcDuzSROevs",
    notes:
      "Figura en Drive como socio de Chalet Venaventa.",
  },
  {
    key: "ivan",
    name: "Iván",
    city: "Gandía",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1zhMxVd_8E0Vihycsm_0fupmthcm_2kA-",
  },
  {
    key: "sara",
    name: "Sara",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1ol4Xl8zTQrpCdKn36uI7qbX4gyKneFS8",
    notes:
      "Drive contiene referencias a Bicorp y Olocau.",
  },
  {
    key: "juanjo",
    name: "Juanjo",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1Bb9TihQ6l5YUVA5x1bl7bMQW8DAXOzvI",
  },
  {
    key: "evidalia",
    name: "Evidalia",
    city: "Torrent",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1iudV0ab5TEgnFSfyyHxPq3TRtzRljgSX",
  },
  {
    key: "raquel",
    name: "Raquel",
    city: "Cullera",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1xHy-eVBoCSrbOzt8kimZR5OuymDA_3Ae",
  },
  {
    key: "rafa",
    name: "Rafa",
    city: "Calicanto",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1wqi-tTUlTjEui4sCjpe5609bml7pLtF3",
  },
  {
    key: "rosa",
    name: "Rosa",
    city: "Moncofa",
    province: "Castellón",
    type: "owner",
    sourceFolderId:
      "16wtDwut1F6lyv4ziWv-3hMcT4JFyQgLO",
  },
  {
    key: "carmen",
    name: "Carmen",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1FbB5UrZpJwUP000N54nkGo3nYjEPC8Ev",
  },
  {
    key: "reinado",
    name: "Reinado",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1VBxmxGXgDSiaAK2pePSEdNxuyL1QscIo",
  },
  {
    key: "javier-zueca",
    name: "Javier Zueca",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1mni4-7PlvEGt6Vsti8JbiHu04-0YdjvF",
  },
  {
    key: "amadeo",
    name: "Amadeo",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "17sdOUoKDFcK7YI3Esv3fS2sN3rYOY3-X",
  },
  {
    key: "jimena",
    name: "Jimena",
    city: "Llíria",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1RAihZPSLu-xAyC0wxqW81h3qxUVrG3zK",
  },
  {
    key: "zoe",
    name: "Zoe",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1FsJ9dNAGX54w_ibwimc4eZuEF-49cdsY",
  },
  {
    key: "salvador",
    name: "Salvador",
    city: "Mas Camarena",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1pnX5-SMaftspW-9oYyRevB3GTUN-6_SZ",
  },
  {
    key: "javier-manises",
    name: "Javier",
    city: "Manises",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1MgCxuXsZwhwyWuHA4i54T-ZGaCUmkRmG",
  },
  {
    key: "manuel",
    name: "Manuel",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1959XCTNxHSKfVSuNEUM6RK3wUuigwT9R",
  },
  {
    key: "vicente-hugo",
    name: "Vicente y Hugo",
    city: "Alboraya",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1ht0wirlTZkTwmZm2nVpP-v7jDaiylyFK",
  },
  {
    key: "joaquin",
    name: "Joaquín",
    city: "Manises",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "195MRLYAVrsdfkD7xuACCcHCcTI_71tJ7",
  },
  {
    key: "adriana",
    name: "Adriana",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1kQhoAQZIxe11e0HoQGJg3_nN52mCXWSn",
  },
  {
    key: "lola",
    name: "Lola",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1JcBXtm8Ye65bKASmSjRnzwZNdO5qWpBh",
  },
  {
    key: "ruben",
    name: "Rubén",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1YkycXt0sAcc4oxzZwghv28HCYWsKFFIn",
  },
  {
    key: "luciana",
    name: "Luciana",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1WnBaVw5adi83jEH6-YN8pQgp2cpwwSpz",
  },
  {
    key: "marito",
    name: "Marito",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1SuL0gt4sIquWrOlGcn2xJzaJljcrbAlo",
  },
  {
    key: "fer",
    name: "Fer",
    city: "Picassent",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1fMOS-quSAwEMLF3BF6BwUDeV5jvHSG77",
  },
  {
    key: "victor",
    name: "Víctor",
    city: "Montserrat",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "1YAdXkGc4j5PQ2td81OJMMcIT_yccsQ-_",
  },
  {
    key: "federico",
    name: "Federico",
    province: "Valencia",
    type: "owner",
    sourceFolderId:
      "155PROR7r1CjbPOKriELVgBsa8JnUcgJy",
  },
];

const venues:
  VenueSeed[] = [
  {
    key: "la-choza-godelleta",
    providerKey: "tony",
    name: "La Choza de Godelleta",
    city: "Godelleta",
    province: "Valencia",
    address:
      "C. la Asociación, 1, 46388 Godelleta, Valencia",
    capacityMax: 100,
    sleeping: 24,
    costFrom: 600,
    clientPriceFrom: 600,
    features: [
      "Piscina privada",
      "Terraza",
      "Barbacoa",
      "Jardín",
      "Cancha de pádel",
      "Salón",
      "Chimenea",
      "Comedor",
      "Cocina equipada",
      "Dormitorios",
      "Baños",
    ],
    modes: [
      "day",
      "overnight",
      "multi_day",
    ],
    description:
      "Chalet de Tony en Godelleta. Datos consolidados de documentación Drive y hoja INFORMACIÓN.",
    sourceFolderId:
      "1gy29OkZBQj1-uT6htuDptJS9pG9h8Ybp",
  },
  {
    key: "villa-entre-naranjos",
    providerKey: "marga",
    name: "Villa Entre Naranjos",
    city: "Picassent",
    province: "Valencia",
    capacityMin: 30,
    capacityMax: 90,
    sleeping: 16,
    features: [
      "Piscina",
      "Barbacoa",
      "Jardines",
      "Campo de fútbol",
      "Carpas",
      "Salón",
      "Chill out",
      "Zona DJ",
      "Cocina",
      "WiFi",
      "Aire acondicionado",
      "Mesas",
      "Sillas",
    ],
    modes: [
      "overnight",
      "multi_day",
      "event",
    ],
    description:
      "Villa de Marga. Información vigente consolidada desde documentación 2026.",
  },
  {
    key: "chalet-daniel-alginet",
    providerKey: "daniel-alginet",
    name: "Chalet Daniel Alginet",
    city: "Alginet",
    province: "Valencia",
    capacityMin: 30,
    capacityMax: 40,
    costFrom: 450,
    clientPriceFrom: 450,
    features: [
      "Piscina",
      "WiFi",
      "Altavoz",
      "Paellero",
      "Barbacoa",
      "Exterior",
    ],
    modes: ["day"],
  },
  {
    key: "masia-del-regal",
    providerKey: "pablo",
    name: "Masía del Regal",
    province: "Valencia",
    capacityMin: 10,
    capacityMax: 50,
    sleeping: 11,
    costFrom: 650,
    clientPriceFrom: 650,
    features: [
      "4 habitaciones",
      "2 baños",
      "2 salones",
      "Cocina",
      "Jardines",
      "Piscina",
      "Billar",
      "Dardos",
      "Chimenea",
      "Parking",
      "Aire acondicionado",
      "Calefacción",
      "WiFi",
      "Barbacoa",
    ],
    modes: [
      "weekend",
      "overnight",
      "event",
    ],
  },
  {
    key: "chalet-silvia-picassent",
    providerKey: "silvia",
    name: "Chalet Silvia Picassent",
    city: "Picassent",
    province: "Valencia",
    capacityMax: 100,
    costFrom: 500,
    clientPriceFrom: 500,
    modes: ["day"],
    features: [
      "Salón",
      "Porche",
      "Jardín",
      "Paellero",
      "Piscina",
      "Mesas",
      "Sillas",
    ],
    description:
      "Chalet Silvia Picassent. Mantener draft por historial comercial contradictorio.",
    sourceFolderId:
      "1u-PG8adZ_iA0JevjGj46_O7FbvelSmY-",
  },
  {
    key: "chalet-lliria-juan-sole",
    providerKey: "juan-sole",
    name: "Chalet Llíria Juan Solé",
    city: "Llíria",
    province: "Valencia",
    modes: ["day","overnight"],
  },
  {
    key: "chalet-silla-niko",
    providerKey: "niko",
    name: "Chalet Niko Silla",
    city: "Silla",
    province: "Valencia",
  },
  {
    key: "chalet-montserrat-daniyil",
    providerKey: "daniyil",
    name: "Chalet Daniyil Montserrat",
    city: "Montserrat",
    province: "Valencia",
  },
  {
    key: "chalet-gandia-ivan",
    providerKey: "ivan",
    name: "Chalet Iván Gandía",
    city: "Gandía",
    province: "Valencia",
  },
  {
    key: "chalet-cullera-raquel",
    providerKey: "raquel",
    name: "Chalet Raquel Cullera",
    city: "Cullera",
    province: "Valencia",
  },
  {
    key: "chalet-calicanto-rafa",
    providerKey: "rafa",
    name: "Chalet Rafa Calicanto",
    city: "Calicanto",
    province: "Valencia",
  },
  {
    key: "chalet-moncofa-rosa",
    providerKey: "rosa",
    name: "Chalet Rosa Moncofa",
    city: "Moncofa",
    province: "Castellón",
  },
  {
    key: "chalet-mas-camarena",
    providerKey: "salvador",
    name: "Chalet Mas Camarena Salvador",
    city: "Mas Camarena",
    province: "Valencia",
  },
  {
    key: "chalet-alboraya-vicente-hugo",
    providerKey: "vicente-hugo",
    name: "Rancho Vicente y Hugo Alboraya",
    city: "Alboraya",
    province: "Valencia",
    capacityMax: 50,
  },
  {
    key: "villa-manises-joaquin",
    providerKey: "joaquin",
    name: "Villa Joaquín Manises",
    city: "Manises",
    province: "Valencia",
  },
  {
    key: "chalet-adriana-valencia",
    providerKey: "adriana",
    name: "Chalet Adriana Valencia",
    province: "Valencia",
  },
  {
    key: "chalet-victor-montserrat",
    providerKey: "victor",
    name: "Chalet Víctor Montserrat",
    city: "Montserrat",
    province: "Valencia",
  },
  {
    key: "chalet-fer-picassent",
    providerKey: "fer",
    name: "Chalet Fer Picassent",
    city: "Picassent",
    province: "Valencia",
  },
];

const history:
  HistorySeed[] = [
  {
    entity: "venue",
    entityKey:
      "la-choza-godelleta",
    type:
      "information_update",
    title:
      "Ficha completa La Choza",
    date:
      "2026-09-15",
    sourceFileId:
      "1PyEOBacgOqhq2NGqV-eYcw2nma0NrG6b91aiDJwpZIU",
    sourceFileName:
      "INFORMACIÓN",
    description:
      "Actualización comercial: capacidad de reunión, alojamiento, precios, fianza, instalaciones, reglas y servicios adicionales.",
    newValue: {
      contact:
        "Tony",
      phone:
        "+34 678 535 098",
      event_capacity:
        100,
      sleeping_capacity:
        "24-30 según fuente",
      owner_price:
        "600 EUR sábado / 20 personas; consultar por grupo",
      deposit:
        "500 exterior / 1000 casa completa con alojamiento",
      extras: [
        "Hummer",
        "DJ",
        "cocinero",
        "limusina",
      ],
    },
  },
  {
    entity: "venue",
    entityKey:
      "la-choza-godelleta",
    type:
      "information_update",
    title:
      "Ficha INFOR La Choza",
    sourceFileId:
      "1ar6Zt820AoBDQPeCQEQBucNeJsuapDSV5jtd37IKhG0",
    sourceFileName:
      "INFOR",
    sourceModifiedAt:
      "2026-09-15T09:12:51.242Z",
    description:
      "Documento con dirección, contacto, estancia, equipamiento, capacidad máxima de 24 huéspedes, normas y servicios incluidos.",
    newValue: {
      address:
        "C. la Asociación, 1, 46388 Godelleta, Valencia",
      sleeping_capacity:
        24,
      stay:
        "2 noches",
      pool:
        true,
      padel:
        true,
      pets:
        false,
      smoking_inside:
        false,
      unauthorized_events:
        false,
      website:
        "https://link.holidu.com/roAtcd",
    },
  },
  {
    entity: "venue",
    entityKey:
      "la-choza-godelleta",
    type:
      "commercial_document",
    title:
      "Venta del Chalet de Tony",
    sourceFileId:
      "1k-CJ6lU4ZNvVBOS117qCvVyDPsnnvEjIOK4prvMemXk",
    sourceFileName:
      "VENTA DEL CHALET DE TONY",
    sourceModifiedAt:
      "2026-06-05T13:44:43.974Z",
    description:
      "Existe documento específico relacionado con la venta del chalet de Tony. Preservar como antecedente comercial.",
  },
  {
    entity: "venue",
    entityKey:
      "villa-entre-naranjos",
    type:
      "information_update",
    title:
      "Actualización Villa Entre Naranjos",
    date:
      "2026-09-15",
    sourceFileId:
      "1PyEOBacgOqhq2NGqV-eYcw2nma0NrG6b91aiDJwpZIU",
    sourceFileName:
      "INFORMACIÓN",
    description:
      "Actualización de capacidad, estancia, instalaciones, fianza y condiciones.",
    newValue: {
      min_capacity:
        30,
      max_capacity:
        90,
      sleeping_capacity:
        16,
      deposit:
        "200-400 EUR según evento",
    },
  },
  {
    entity: "venue",
    entityKey:
      "chalet-daniel-alginet",
    type:
      "information_update",
    title:
      "Actualización Chalet Alginet",
    date:
      "2026-09-15",
    sourceFileId:
      "1PyEOBacgOqhq2NGqV-eYcw2nma0NrG6b91aiDJwpZIU",
    sourceFileName:
      "INFORMACIÓN",
    description:
      "Capacidad, precio propietario, horario, fianza y condiciones.",
    newValue: {
      capacity:
        "30-40+",
      price:
        450,
      deposit:
        150,
      schedule:
        "11:00-21:00 fines de semana",
    },
  },
  {
    entity: "venue",
    entityKey:
      "masia-del-regal",
    type:
      "information_update",
    title:
      "Actualización Masía del Regal",
    date:
      "2026-09-15",
    sourceFileId:
      "1PyEOBacgOqhq2NGqV-eYcw2nma0NrG6b91aiDJwpZIU",
    sourceFileName:
      "INFORMACIÓN",
    description:
      "Capacidad, precios, estancia, instalaciones, fianzas y extras.",
    newValue: {
      sleeping_capacity:
        "10-11",
      event_capacity:
        50,
      weekend_price:
        "650-850 EUR",
      minimum_stay:
        "2 noches",
      accommodation_deposit:
        300,
      event_deposit:
        500,
    },
  },
  {
    entity: "venue",
    entityKey:
      "chalet-silvia-picassent",
    type:
      "commercial_status",
    title:
      "Estado comercial contradictorio",
    sourceFileId:
      "1pJ2Tk4A_WkgcuOBeDTmWNOpiNEo6ZLhVuH4dxR4b81A",
    sourceFileName:
      "Todos los chalet y su información resumida",
    confidence:
      "conflict",
    description:
      "El documento contiene referencias contradictorias: 'No quiere volver a trabajar con nosotros' y posteriormente 'quiere trabajar con nosotros / pendiente de retomar'. Mantener draft hasta verificar.",
  },
  {
    entity: "venue",
    entityKey:
      "chalet-silvia-picassent",
    type:
      "information_document",
    title:
      "Información actual Silvia",
    sourceFileId:
      "1AWrV2zvoxbRrsogTactxYj0ilXCSeP28DBGq2SZdnJc",
    sourceFileName:
      "Información actual Silvia",
    sourceModifiedAt:
      "2026-05-19T19:43:03.552Z",
    description:
      "Documento específico de información actual del Chalet Silvia.",
  },
];

async function providerBySeed(
  seed:
    ProviderSeed,
) {
  const p =
    phone(
      seed.phone,
    );

  if (p) {
    const rows =
      await supabaseRequest<
        DbRow[]
      >({
        table:
          "crm_providers",
        query:
          `?company_id=eq.${enc(
            COMPANY_ID!,
          )}`
          + `&phone=eq.${enc(
            p,
          )}`
          + "&select=*"
          + "&limit=1",
      });

    if (rows[0]) {
      return rows[0];
    }
  }

  const rows =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_providers",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&name=eq.${enc(
          seed.name,
        )}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

async function upsertProvider(
  seed:
    ProviderSeed,
) {
  const existing =
    await providerBySeed(
      seed,
    );

  const body = {
    company_id:
      COMPANY_ID,
    name:
      seed.name,
    contact_name:
      seed.name,
    phone:
      phone(
        seed.phone,
      ),
    whatsapp:
      phone(
        seed.phone,
      ),
    province:
      seed.province
      ?? null,
    city:
      seed.city
      ?? null,
    service_area:
      [
        seed.city,
        seed.province,
      ]
        .filter(Boolean)
        .join(", ")
      || null,
    notes:
      seed.notes
      ?? null,
  };

  if (DRY_RUN) {
    console.log(
      existing
        ? "[DRY PROVIDER UPDATE]"
        : "[DRY PROVIDER CREATE]",
      seed.name,
    );

    return existing
      ?? {
        id:
          `dry-${seed.key}`,
      };
  }

  if (existing) {
    const rows =
      await supabaseRequest<
        DbRow[]
      >({
        table:
          "crm_providers",
        method:
          "PATCH",
        query:
          `?company_id=eq.${enc(
            COMPANY_ID!,
          )}`
          + `&id=eq.${enc(
            String(
              existing.id,
            ),
          )}`,
        body,
      });

    return rows[0]
      ?? existing;
  }

  const rows =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_providers",
      method:
        "POST",
      body,
    });

  if (!rows[0]) {
    throw new Error(
      `PROVIDER_CREATE_FAILED:${seed.name}`,
    );
  }

  return rows[0];
}

async function upsertProfile(
  seed:
    ProviderSeed,
  providerId:
    string,
) {
  if (DRY_RUN) {
    return;
  }

  const existing =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_provider_profiles",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&provider_id=eq.${enc(
          providerId,
        )}`
        + "&select=id"
        + "&limit=1",
    });

  const body = {
    company_id:
      COMPANY_ID,
    provider_id:
      providerId,
    provider_type:
      seed.type
      ?? "owner",
    factual_summary:
      [
        `${seed.name} figura en Google Drive como ${seed.type ?? "propietario"}.`,
        seed.city
          ? `Zona: ${seed.city}.`
          : null,
        seed.notes
          ?? null,
      ]
        .filter(Boolean)
        .join(" "),
    commercial_relationship:
      "Contacto/proveedor histórico de Eventos Mediterráneo",
    factual_notes:
      seed.notes
      ?? null,
    source_metadata: {
      source:
        "google-drive",
      folder_id:
        seed.sourceFolderId
        ?? null,
    },
  };

  if (existing[0]) {
    await supabaseRequest({
      table:
        "crm_provider_profiles",
      method:
        "PATCH",
      query:
        `?id=eq.${enc(
          String(
            existing[0].id,
          ),
        )}`,
      body,
    });
  } else {
    await supabaseRequest({
      table:
        "crm_provider_profiles",
      method:
        "POST",
      body,
    });
  }
}

async function venueBySlug(
  slug:
    string,
) {
  const rows =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_venues",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&slug=eq.${enc(
          slug,
        )}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

async function upsertVenue(
  seed:
    VenueSeed,
  providerId:
    string,
) {
  const slug =
    slugify(
      seed.key,
    );

  const existing =
    await venueBySlug(
      slug,
    );

  const body = {
    company_id:
      COMPANY_ID,
    provider_id:
      providerId,
    name:
      seed.name,
    slug,
    status:
      "draft",
    description:
      seed.description
      ?? null,
    province:
      seed.province
      ?? "Valencia",
    city:
      seed.city
      ?? null,
    address:
      seed.address
      ?? null,
    capacity_min:
      seed.capacityMin
      ?? null,
    capacity_max:
      seed.capacityMax
      ?? null,
    cost_from:
      seed.costFrom
      ?? 0,
    client_price_from:
      seed.clientPriceFrom
      ?? seed.costFrom
      ?? 0,
    currency:
      "EUR",
    features:
      seed.features
      ?? [],
    included_services:
      [],
    suitable_for:
      [],
    rental_modes:
      seed.modes
      ?? [],
    event_types_allowed:
      [],
    events_allowed:
      seed.eventsAllowed
      ?? true,
    parties_allowed:
      seed.partiesAllowed
      ?? true,
    max_event_guests:
      seed.capacityMax
      ?? null,
    max_sleeping_guests:
      seed.sleeping
      ?? null,
  };

  if (DRY_RUN) {
    console.log(
      existing
        ? "[DRY VENUE UPDATE]"
        : "[DRY VENUE CREATE]",
      seed.name,
    );

    return existing
      ?? {
        id:
          `dry-${seed.key}`,
      };
  }

  if (existing) {
    const rows =
      await supabaseRequest<
        DbRow[]
      >({
        table:
          "crm_venues",
        method:
          "PATCH",
        query:
          `?company_id=eq.${enc(
            COMPANY_ID!,
          )}`
          + `&id=eq.${enc(
            String(
              existing.id,
            ),
          )}`,
        body,
      });

    return rows[0]
      ?? existing;
  }

  const rows =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_venues",
      method:
        "POST",
      body,
    });

  if (!rows[0]) {
    throw new Error(
      `VENUE_CREATE_FAILED:${seed.name}`,
    );
  }

  return rows[0];
}

async function insertHistory(
  seed:
    HistorySeed,
  providerIds:
    Map<string,string>,
  venueIds:
    Map<string,string>,
) {
  if (DRY_RUN) {
    console.log(
      "[DRY HISTORY]",
      seed.title,
    );
    return;
  }

  const providerId =
    seed.entity === "provider"
      ? providerIds.get(
          seed.entityKey,
        )
      : null;

  const venueId =
    seed.entity === "venue"
      ? venueIds.get(
          seed.entityKey,
        )
      : null;

  const existing =
    await supabaseRequest<
      DbRow[]
    >({
      table:
        "crm_entity_history",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&entity_type=eq.${enc(
          seed.entity,
        )}`
        + `&source_file_id=eq.${enc(
          seed.sourceFileId,
        )}`
        + `&history_type=eq.${enc(
          seed.type,
        )}`
        + `&title=eq.${enc(
          seed.title,
        )}`
        + "&select=id"
        + "&limit=1",
    });

  if (existing[0]) {
    return;
  }

  await supabaseRequest({
    table:
      "crm_entity_history",
    method:
      "POST",
    body: {
      company_id:
        COMPANY_ID,
      entity_type:
        seed.entity,
      provider_id:
        providerId
        ?? null,
      venue_id:
        venueId
        ?? null,
      event_id:
        null,
      occurred_on:
        seed.date
        ?? null,
      history_type:
        seed.type,
      title:
        seed.title,
      description:
        seed.description,
      old_value:
        seed.oldValue
        ?? null,
      new_value:
        seed.newValue
        ?? null,
      source:
        "google-drive",
      source_file_id:
        seed.sourceFileId,
      source_file_name:
        seed.sourceFileName,
      source_folder_id:
        seed.sourceFolderId
        ?? null,
      source_modified_at:
        seed.sourceModifiedAt
        ?? null,
      confidence:
        seed.confidence
        ?? "source",
      metadata: {},
    },
  });
}


async function hydrateSupabaseRuntime() {
  const integrations =
    await readIntegrationSecrets();

  const url =
    integrations
      .supabase
      .url
      ?.trim();

  const serviceRoleKey =
    integrations
      .supabase
      .serviceRoleKey
      ?.trim();

  if (
    !url
    || !serviceRoleKey
  ) {
    throw new Error(
      "SUPABASE_INTEGRATION_NOT_CONFIGURED",
    );
  }

  if (
    !process.env
      .SUPABASE_URL
  ) {
    process.env
      .SUPABASE_URL =
        url;
  }

  if (
    !process.env
      .SUPABASE_SERVICE_ROLE_KEY
  ) {
    process.env
      .SUPABASE_SERVICE_ROLE_KEY =
        serviceRoleKey;
  }

  console.log(
    "[RUNTIME] Supabase integration loaded",
  );
}

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );
  console.log(
    DRY_RUN
      ? "DRIVE STRUCTURED IMPORT — DRY RUN"
      : "DRIVE STRUCTURED IMPORT — WRITE",
  );
  console.log(
    "Providers:",
    providers.length,
  );
  console.log(
    "Venues:",
    venues.length,
  );
  console.log(
    "History:",
    history.length,
  );
  console.log(
    "==============================================",
  );

  const providerIds =
    new Map<
      string,
      string
    >();

  for (
    const seed
    of providers
  ) {
    const row =
      await upsertProvider(
        seed,
      );

    const id =
      String(
        row.id,
      );

    providerIds.set(
      seed.key,
      id,
    );

    await upsertProfile(
      seed,
      id,
    );

    console.log(
      "[PROVIDER]",
      seed.name,
    );
  }

  const venueIds =
    new Map<
      string,
      string
    >();

  for (
    const seed
    of venues
  ) {
    const providerId =
      providerIds.get(
        seed.providerKey,
      );

    if (!providerId) {
      throw new Error(
        `PROVIDER_NOT_MAPPED:${seed.providerKey}`,
      );
    }

    const row =
      await upsertVenue(
        seed,
        providerId,
      );

    venueIds.set(
      seed.key,
      String(
        row.id,
      ),
    );

    console.log(
      "[VENUE]",
      seed.name,
    );
  }

  for (
    const seed
    of history
  ) {
    await insertHistory(
      seed,
      providerIds,
      venueIds,
    );

    console.log(
      "[HISTORY]",
      seed.title,
    );
  }

  console.log(
    "==============================================",
  );
  console.log(
    DRY_RUN
      ? "DRY_RUN_COMPLETE"
      : "IMPORT_COMPLETE",
  );
  console.log(
    "==============================================",
  );
}

main()
  .catch(
    error => {
      console.error(
        "IMPORT_FAILED",
        error,
      );

      process.exitCode = 1;
    },
  );
