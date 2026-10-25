import fs from "node:fs";
import path from "node:path";

import {
  readIntegrationSecrets,
} from "../../apps/api/src/services/integrations/integration-secrets.repository.js";


/* ============================================================
   CONFIG
   ============================================================ */

const COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID
  || "eventos-mediterraneo";

const DRIVE_ROOT_ID =
  process.env.EVENTOS_DRIVE_ROOT_ID
  || "10jVdlebitqrSVxvWJOFOz2I5I0GyX3Fv";

const APPLY =
  process.argv.includes("--apply");

const FORCE =
  process.argv.includes("--force");

const ROOT =
  "/var/www/control";

const STAMP =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const BACKUP_DIR =
  path.join(
    ROOT,
    "backups/provider-drive-resync",
  );

const REPORT_DIR =
  path.join(
    ROOT,
    "reports/provider-drive-resync",
  );

fs.mkdirSync(
  BACKUP_DIR,
  {
    recursive: true,
  },
);

fs.mkdirSync(
  REPORT_DIR,
  {
    recursive: true,
  },
);


/* ============================================================
   TYPES
   ============================================================ */

type Json =
  Record<string, any>;

type DriveNode = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  webViewLink?: string;

  path: string;

  parentId?: string;
};

type Evidence = {
  fileId: string;
  fileName: string;
  filePath: string;
  modifiedTime?: string;
  url?: string;

  text: string;
};

type Extracted = {
  phones: string[];
  emails: string[];
  postalCodes: string[];
  addresses: string[];
  percentages: string[];
  websites: string[];

  evidence: Evidence[];
};

type Match = {
  provider: Json;

  profile?: Json;

  folder?: DriveNode;

  score: number;

  method:
    | "source_metadata"
    | "exact"
    | "normalized"
    | "fuzzy"
    | "none";
};

type PlannedUpdate = {
  providerId: string;
  providerName: string;

  folderId?: string;
  folderPath?: string;

  matchScore: number;
  matchMethod: string;

  providerPatch: Json;
  profilePatch: Json;

  extracted: {
    phones: string[];
    emails: string[];
    postalCodes: string[];
    addresses: string[];
    percentages: string[];
    websites: string[];
  };

  sourceFiles: {
    id: string;
    name: string;
    path: string;
    modifiedTime?: string;
  }[];

  conflicts: string[];

  changed: boolean;
};


/* ============================================================
   ENV / AUTH
   ============================================================ */

let integrationSecrets:
  Record<string, any>
  | null = null;


async function hydrateIntegrationRuntime() {
  const integrations =
    (
      await readIntegrationSecrets()
    ) as Record<string, any>;

  integrationSecrets =
    integrations;


  const supabaseUrl =
    String(
      integrations
        ?.supabase
        ?.url
      || "",
    ).trim();


  const serviceRoleKey =
    String(
      integrations
        ?.supabase
        ?.serviceRoleKey
      || "",
    ).trim();


  if (
    !process.env.SUPABASE_URL
    &&
    supabaseUrl
  ) {
    process.env.SUPABASE_URL =
      supabaseUrl;
  }


  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY
    &&
    serviceRoleKey
  ) {
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      serviceRoleKey;
  }


  console.log(
    `INTEGRATION_SUPABASE_URL=${supabaseUrl ? 1 : 0}`,
  );

  console.log(
    `INTEGRATION_SUPABASE_SERVICE_ROLE=${serviceRoleKey ? 1 : 0}`,
  );


  /*
   * Mostrar solamente los NOMBRES de configuraciones disponibles.
   * Nunca valores.
   */
  const topKeys =
    Object.keys(
      integrations || {},
    )
      .sort();


  console.log(
    "INTEGRATION_KEYS=",
    topKeys.join(","),
  );


  for (
    const key
    of topKeys
  ) {
    const value =
      integrations[key];

    if (
      value
      &&
      typeof value === "object"
      &&
      !Array.isArray(value)
    ) {
      console.log(
        `INTEGRATION_FIELDS_${key}=`
        +
        Object.keys(value)
          .sort()
          .join(","),
      );
    }
  }
}


function nestedValue(
  root: any,
  paths: string[][],
) {
  for (
    const parts
    of paths
  ) {
    let value =
      root;

    let ok =
      true;


    for (
      const part
      of parts
    ) {
      if (
        !value
        ||
        typeof value !== "object"
        ||
        !(part in value)
      ) {
        ok =
          false;

        break;
      }

      value =
        value[part];
    }


    if (
      ok
      &&
      value !== null
      &&
      value !== undefined
      &&
      String(value).trim()
    ) {
      return {
        path:
          parts.join("."),

        value:
          String(value).trim(),
      };
    }
  }


  return null;
}


function firstEnv(
  names: string[],
) {
  for (
    const name
    of names
  ) {
    const value =
      process.env[name];

    if (
      value
      &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}


function supabaseUrl() {
  return firstEnv([
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
  ]);
}


function supabaseKey() {
  return firstEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);
}

async function getDriveToken() {
  /*
   * 1. Variables directas por compatibilidad.
   */
  const direct =
    firstEnv([
      "GOOGLE_DRIVE_ACCESS_TOKEN",
      "GOOGLE_ACCESS_TOKEN",
      "GDRIVE_ACCESS_TOKEN",
      "DRIVE_ACCESS_TOKEN",
    ]);


  if (direct) {
    console.log(
      "DRIVE_AUTH_SOURCE=env_access_token",
    );

    return direct;
  }


  /*
   * 2. Integration secrets.
   * Admitimos varios nombres porque las integraciones fueron
   * evolucionando, pero nunca imprimimos el valor.
   */
  const integrations =
    integrationSecrets
    || {};


  const directSecret =
    nestedValue(
      integrations,
      [
        [
          "googleDrive",
          "accessToken",
        ],
        [
          "googleDrive",
          "access_token",
        ],
        [
          "drive",
          "accessToken",
        ],
        [
          "drive",
          "access_token",
        ],
        [
          "google",
          "accessToken",
        ],
        [
          "google",
          "access_token",
        ],
        [
          "googleCalendar",
          "accessToken",
        ],
        [
          "googleCalendar",
          "access_token",
        ],
      ],
    );


  if (
    directSecret
  ) {
    console.log(
      `DRIVE_AUTH_SOURCE=${directSecret.path}`,
    );

    return directSecret.value;
  }


  /*
   * 3. Intentar refresh token almacenado.
   */
  const refresh =
    nestedValue(
      integrations,
      [
        [
          "googleDrive",
          "refreshToken",
        ],
        [
          "googleDrive",
          "refresh_token",
        ],
        [
          "drive",
          "refreshToken",
        ],
        [
          "drive",
          "refresh_token",
        ],
        [
          "google",
          "refreshToken",
        ],
        [
          "google",
          "refresh_token",
        ],
        [
          "googleCalendar",
          "refreshToken",
        ],
        [
          "googleCalendar",
          "refresh_token",
        ],
      ],
    );


  const clientId =
    nestedValue(
      integrations,
      [
        [
          "googleDrive",
          "clientId",
        ],
        [
          "googleDrive",
          "client_id",
        ],
        [
          "google",
          "clientId",
        ],
        [
          "google",
          "client_id",
        ],
        [
          "googleCalendar",
          "clientId",
        ],
        [
          "googleCalendar",
          "client_id",
        ],
      ],
    );


  const clientSecret =
    nestedValue(
      integrations,
      [
        [
          "googleDrive",
          "clientSecret",
        ],
        [
          "googleDrive",
          "client_secret",
        ],
        [
          "google",
          "clientSecret",
        ],
        [
          "google",
          "client_secret",
        ],
        [
          "googleCalendar",
          "clientSecret",
        ],
        [
          "googleCalendar",
          "client_secret",
        ],
      ],
    );


  /*
   * También permitir client id / secret de env si el refresh
   * está en la integración.
   */
  const effectiveClientId =
    clientId?.value
    ||
    firstEnv([
      "GOOGLE_CLIENT_ID",
      "GOOGLE_DRIVE_CLIENT_ID",
    ]);


  const effectiveClientSecret =
    clientSecret?.value
    ||
    firstEnv([
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_DRIVE_CLIENT_SECRET",
    ]);


  if (
    refresh?.value
    &&
    effectiveClientId
    &&
    effectiveClientSecret
  ) {
    const body =
      new URLSearchParams({
        client_id:
          effectiveClientId,

        client_secret:
          effectiveClientSecret,

        refresh_token:
          refresh.value,

        grant_type:
          "refresh_token",
      });


    const response =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body,
        },
      );


    if (
      !response.ok
    ) {
      const bodyText =
        await response.text();

      throw new Error(
        `GOOGLE_REFRESH_FAILED HTTP ${response.status}: ${bodyText.slice(0, 300)}`,
      );
    }


    const json =
      (
        await response.json()
      ) as Record<
        string,
        any
      >;


    if (
      !json.access_token
    ) {
      throw new Error(
        "GOOGLE_REFRESH_NO_ACCESS_TOKEN",
      );
    }


    console.log(
      `DRIVE_AUTH_SOURCE=refresh:${refresh.path}`,
    );

    return String(
      json.access_token,
    );
  }


  /*
   * Seguridad: mostramos solo nombres de claves, jamás secretos.
   */
  throw new Error(
    "DRIVE_AUTH_MISSING_IN_INTEGRATION_SECRETS",
  );
}


/* ============================================================
   HTTP
   ============================================================ */

async function supabaseGet(
  table: string,
  query = "",
) {
  const url =
    `${supabaseUrl()}/rest/v1/${table}${query}`;


  const response =
    await fetch(
      url,
      {
        headers: {
          apikey:
            supabaseKey(),

          Authorization:
            `Bearer ${supabaseKey()}`,
        },
      },
    );


  if (
    !response.ok
  ) {
    const body =
      await response.text();

    throw new Error(
      `SUPABASE_GET ${table} HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }


  return (await response.json()) as Json[];
}


async function supabasePatch(
  table: string,
  filter: string,
  patch: Json,
) {
  if (
    !Object.keys(
      patch,
    ).length
  ) {
    return;
  }


  const response =
    await fetch(
      `${supabaseUrl()}/rest/v1/${table}?${filter}`,
      {
        method:
          "PATCH",

        headers: {
          apikey:
            supabaseKey(),

          Authorization:
            `Bearer ${supabaseKey()}`,

          "Content-Type":
            "application/json",

          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            patch,
          ),
      },
    );


  if (
    !response.ok
  ) {
    const body =
      await response.text();

    throw new Error(
      `SUPABASE_PATCH ${table} HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }
}


async function supabaseInsert(
  table: string,
  rows: Json[],
) {
  if (
    !rows.length
  ) {
    return;
  }


  const response =
    await fetch(
      `${supabaseUrl()}/rest/v1/${table}`,
      {
        method:
          "POST",

        headers: {
          apikey:
            supabaseKey(),

          Authorization:
            `Bearer ${supabaseKey()}`,

          "Content-Type":
            "application/json",

          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            rows,
          ),
      },
    );


  if (
    !response.ok
  ) {
    const body =
      await response.text();

    throw new Error(
      `SUPABASE_INSERT ${table} HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }
}


/* ============================================================
   GOOGLE DRIVE REST
   ============================================================ */

function driveHeaders(
  token: string,
) {
  return {
    Authorization:
      `Bearer ${token}`,
  };
}


async function driveListChildren(
  token: string,
  parentId: string,
) {
  const result:
    Json[] = [];

  let pageToken =
    "";


  do {
    const params =
      new URLSearchParams({
        q:
          `'${parentId}' in parents and trashed = false`,

        fields:
          "nextPageToken,files(id,name,mimeType,parents,modifiedTime,webViewLink,size)",

        pageSize:
          "1000",

        orderBy:
          "folder,name",
      });


    if (
      pageToken
    ) {
      params.set(
        "pageToken",
        pageToken,
      );
    }


    const response =
      await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        {
          headers:
            driveHeaders(
              token,
            ),
        },
      );


    if (
      !response.ok
    ) {
      const body =
        await response.text();

      throw new Error(
        `DRIVE_LIST HTTP ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    const json =
      (await response.json()) as Json;


    result.push(
      ...(
        json.files
        || []
      ),
    );


    pageToken =
      String(
        json.nextPageToken
        || "",
      );
  }
  while (
    pageToken
  );


  return result;
}


async function exportGoogleText(
  token: string,
  file: DriveNode,
) {
  let mime =
    "";


  if (
    file.mimeType
    === "application/vnd.google-apps.document"
  ) {
    mime =
      "text/plain";
  }


  if (
    file.mimeType
    === "application/vnd.google-apps.spreadsheet"
  ) {
    mime =
      "text/csv";
  }


  if (
    file.mimeType
    === "application/vnd.google-apps.presentation"
  ) {
    mime =
      "text/plain";
  }


  if (
    !mime
  ) {
    return "";
  }


  const params =
    new URLSearchParams({
      mimeType:
        mime,
    });


  const response =
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}/export?${params}`,
      {
        headers:
          driveHeaders(
            token,
          ),
      },
    );


  if (
    !response.ok
  ) {
    return "";
  }


  return await response.text();
}


/* ============================================================
   NORMALIZATION
   ============================================================ */

function normalize(
  value: unknown,
) {
  return String(
    value
    ?? "",
  )
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


const NOISE =
  new Set([
    "catering",
    "empresa",
    "servicio",
    "servicios",
    "proveedor",
    "provedor",
    "carpeta",
    "eventos",
    "evento",
    "alquiler",
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "y",
    "para",
    "valencia",
  ]);


function tokens(
  value: unknown,
) {
  return normalize(
    value,
  )
    .split(
      " ",
    )
    .filter(
      token =>
        token.length > 1
        &&
        !NOISE.has(
          token,
        ),
    );
}


function cleanName(
  value: unknown,
) {
  return tokens(
    value,
  ).join(
    " ",
  );
}


function similarity(
  a: unknown,
  b: unknown,
) {
  const aa =
    new Set(
      tokens(a),
    );

  const bb =
    new Set(
      tokens(b),
    );


  if (
    !aa.size
    ||
    !bb.size
  ) {
    return 0;
  }


  let intersection =
    0;


  for (
    const token
    of aa
  ) {
    if (
      bb.has(
        token,
      )
    ) {
      intersection++;
    }
  }


  const union =
    new Set([
      ...aa,
      ...bb,
    ]).size;


  let score =
    intersection
    /
    union;


  const cleanA =
    [
      ...aa,
    ].join(" ");

  const cleanB =
    [
      ...bb,
    ].join(" ");


  if (
    cleanA
    &&
    cleanB
    &&
    (
      cleanA.includes(
        cleanB,
      )
      ||
      cleanB.includes(
        cleanA,
      )
    )
  ) {
    score =
      Math.max(
        score,
        0.88,
      );
  }


  return score;
}


function unique<T>(
  values: T[],
) {
  return [
    ...new Set(
      values,
    ),
  ];
}


/* ============================================================
   TREE CRAWL
   ============================================================ */

async function crawlDriveTree(
  token: string,
  rootId: string,
) {
  const folders:
    DriveNode[] = [];

  const files:
    DriveNode[] = [];


  const queue = [
    {
      id:
        rootId,

      path:
        "",
    },
  ];


  const visited =
    new Set<string>();


  while (
    queue.length
  ) {
    const current =
      queue.shift()!;


    if (
      visited.has(
        current.id,
      )
    ) {
      continue;
    }


    visited.add(
      current.id,
    );


    const children =
      await driveListChildren(
        token,
        current.id,
      );


    for (
      const child
      of children
    ) {
      const childPath =
        current.path
          ? `${current.path} / ${child.name}`
          : child.name;


      const node:
        DriveNode = {
        id:
          String(
            child.id,
          ),

        name:
          String(
            child.name
            || "",
          ),

        mimeType:
          String(
            child.mimeType
            || "",
          ),

        parents:
          child.parents,

        modifiedTime:
          child.modifiedTime,

        webViewLink:
          child.webViewLink,

        path:
          childPath,

        parentId:
          current.id,
      };


      if (
        node.mimeType
        === "application/vnd.google-apps.folder"
      ) {
        folders.push(
          node,
        );


        queue.push({
          id:
            node.id,

          path:
            childPath,
        });
      }
      else {
        files.push(
          node,
        );
      }
    }


    if (
      visited.size % 50
      === 0
    ) {
      console.log(
        `DRIVE_FOLDERS_SCANNED=${visited.size}`,
      );
    }
  }


  return {
    folders,
    files,
  };
}


/* ============================================================
   PROVIDER/FOLDER MATCHING
   ============================================================ */

function metadataFolderId(
  profile?: Json,
) {
  if (
    !profile
  ) {
    return "";
  }


  const metadata =
    profile.source_metadata
    || {};


  const candidates = [
    metadata.drive_folder_id,
    metadata.google_drive_folder_id,
    metadata.source_folder_id,
    metadata.folder_id,
    metadata.drive_id,
    profile.source_folder_id,
    profile.google_drive_folder_id,
  ];


  return String(
    candidates.find(
      Boolean,
    )
    || "",
  );
}


function matchProvider(
  provider: Json,
  profile: Json | undefined,
  folders: DriveNode[],
) : Match {
  const knownFolderId =
    metadataFolderId(
      profile,
    );


  if (
    knownFolderId
  ) {
    const folder =
      folders.find(
        item =>
          item.id
          === knownFolderId,
      );


    if (
      folder
    ) {
      return {
        provider,
        profile,
        folder,
        score:
          1,

        method:
          "source_metadata",
      };
    }
  }


  const providerName =
    displayProviderName(
      provider,
    );

  const normal =
    normalize(
      providerName,
    );

  const cleaned =
    cleanName(
      providerName,
    );


  let best:
    DriveNode | undefined;

  let bestScore =
    0;

  let method:
    Match["method"] =
      "none";


  for (
    const folder
    of folders
  ) {
    const folderNormal =
      normalize(
        folder.name,
      );

    const folderClean =
      cleanName(
        folder.name,
      );


    if (
      normal
      &&
      folderNormal
      &&
      normal
      === folderNormal
    ) {
      return {
        provider,
        profile,
        folder,
        score:
          1,

        method:
          "exact",
      };
    }


    if (
      cleaned
      &&
      folderClean
      &&
      cleaned
      === folderClean
    ) {
      return {
        provider,
        profile,
        folder,
        score:
          0.98,

        method:
          "normalized",
      };
    }


    const score =
      similarity(
        providerName,
        folder.name,
      );


    if (
      score
      >
      bestScore
    ) {
      bestScore =
        score;

      best =
        folder;

      method =
        "fuzzy";
    }
  }


  if (
    best
    &&
    bestScore >= 0.50
  ) {
    return {
      provider,
      profile,
      folder:
        best,

      score:
        bestScore,

      method,
    };
  }


  return {
    provider,
    profile,
    score:
      bestScore,

    method:
      "none",
  };
}


function displayProviderName(
  provider: Json,
) {
  return String(
    provider.name
    ||
    provider.contact_name
    ||
    "Proveedor sin nombre",
  );
}


/* ============================================================
   SOURCE COLLECTION
   ============================================================ */

function fileInsideFolder(
  file: DriveNode,
  folder: DriveNode,
) {
  return (
    file.path
      === folder.path
    ||
    file.path.startsWith(
      `${folder.path} / `,
    )
  );
}


async function collectEvidence(
  token: string,
  folder: DriveNode,
  allFiles: DriveNode[],
) {
  const candidates =
    allFiles
      .filter(
        file =>
          fileInsideFolder(
            file,
            folder,
          ),
      )
      .filter(
        file =>
          [
            "application/vnd.google-apps.document",
            "application/vnd.google-apps.spreadsheet",
            "application/vnd.google-apps.presentation",
          ].includes(
            file.mimeType,
          ),
      )
      .slice(
        0,
        250,
      );


  const evidence:
    Evidence[] = [];


  for (
    const file
    of candidates
  ) {
    const text =
      await exportGoogleText(
        token,
        file,
      );


    if (
      !text.trim()
    ) {
      continue;
    }


    evidence.push({
      fileId:
        file.id,

      fileName:
        file.name,

      filePath:
        file.path,

      modifiedTime:
        file.modifiedTime,

      url:
        file.webViewLink,

      text:
        text.slice(
          0,
          100_000,
        ),
    });
  }


  return evidence;
}


/* ============================================================
   DATA EXTRACTION
   ============================================================ */

function extractEmails(
  text: string,
) {
  const matches =
    text.match(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    )
    || [];


  return unique(
    matches.map(
      value =>
        value
          .trim()
          .toLowerCase(),
    ),
  );
}


function normalizePhone(
  raw: string,
) {
  let phone =
    raw
      .trim()
      .replace(
        /[().]/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      );


  const digits =
    phone.replace(
      /\D/g,
      "",
    );


  if (
    digits.length
    < 9
    ||
    digits.length > 13
  ) {
    return "";
  }


  if (
    digits.length === 9
    &&
    /^[6789]/.test(
      digits,
    )
  ) {
    return digits;
  }


  if (
    digits.length === 11
    &&
    digits.startsWith(
      "34",
    )
  ) {
    return `+${digits}`;
  }


  if (
    phone.startsWith(
      "+",
    )
  ) {
    return `+${digits}`;
  }


  return digits;
}


function extractPhones(
  text: string,
) {
  const matches =
    text.match(
      /(?:\+34[\s.-]*)?(?:[6789]\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|[6789]\d{8})/g,
    )
    || [];


  return unique(
    matches
      .map(
        normalizePhone,
      )
      .filter(
        Boolean,
      ),
  );
}


function extractPostalCodes(
  text: string,
) {
  return unique(
    (
      text.match(
        /\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b/g,
      )
      || []
    ),
  );
}


function extractPercentages(
  text: string,
) {
  return unique(
    (
      text.match(
        /\b\d{1,2}(?:[.,]\d+)?\s*%/g,
      )
      || []
    )
      .map(
        item =>
          item.replace(
            /\s+/g,
            "",
          ),
      ),
  );
}


function extractWebsites(
  text: string,
) {
  return unique(
    (
      text.match(
        /\bhttps?:\/\/[^\s<>"')]+/gi,
      )
      || []
    ),
  );
}


function extractAddresses(
  text: string,
) {
  const lines =
    text
      .split(
        /\r?\n/,
      )
      .map(
        line =>
          line
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
      )
      .filter(
        Boolean,
      );


  const addressWords =
    /\b(calle|c\/|carrer|avenida|av\.?|avinguda|plaza|plaça|camino|carretera|paseo|passeig|ronda|pol[ií]gono)\b/i;


  return unique(
    lines.filter(
      line =>
        addressWords.test(
          line,
        )
        ||
        (
          /\b\d{5}\b/.test(
            line,
          )
          &&
          line.length
          <= 180
        ),
    ),
  );
}


function extractFromEvidence(
  evidence: Evidence[],
): Extracted {
  const text =
    evidence
      .map(
        item =>
          item.text,
      )
      .join(
        "\n",
      );


  return {
    phones:
      extractPhones(
        text,
      ),

    emails:
      extractEmails(
        text,
      ),

    postalCodes:
      extractPostalCodes(
        text,
      ),

    addresses:
      extractAddresses(
        text,
      ),

    percentages:
      extractPercentages(
        text,
      ),

    websites:
      extractWebsites(
        text,
      ),

    evidence,
  };
}


/* ============================================================
   FIELD LOGIC
   ============================================================ */

function isEmpty(
  value: any,
) {
  return (
    value === null
    ||
    value === undefined
    ||
    value === ""
    ||
    (
      Array.isArray(
        value,
      )
      &&
      value.length === 0
    )
  );
}


function choose(
  existing: any,
  candidates: string[],
) {
  if (
    !FORCE
    &&
    !isEmpty(
      existing,
    )
  ) {
    return existing;
  }


  return (
    candidates[0]
    ||
    existing
    ||
    null
  );
}


function availableColumn(
  row: Json,
  names: string[],
) {
  return names.find(
    name =>
      Object.prototype.hasOwnProperty.call(
        row,
        name,
      ),
  );
}


function bestCity(
  extracted: Extracted,
) {
  const allText =
    extracted.evidence
      .map(
        item =>
          item.text,
      )
      .join(
        "\n",
      );


  const candidates = [
    "València",
    "Valencia",
    "Torrent",
    "Picassent",
    "Alzira",
    "Albal",
    "Manises",
    "Massanassa",
    "Benimaclet",
    "Paterna",
    "Silla",
    "Alginet",
    "Moncófar",
    "Moncofa",
    "Cullera",
  ];


  return (
    candidates.find(
      city =>
        lowerText(
          allText,
        ).includes(
          lowerText(
            city,
          ),
        ),
    )
    || ""
  );
}


function lowerText(
  value: string,
) {
  return value
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}


function mergeSourceMetadata(
  current: any,
  match: Match,
  extracted: Extracted,
) {
  const base =
    current
    &&
    typeof current
    === "object"
      ? current
      : {};


  return {
    ...base,

    drive_sync: {
      synced_at:
        new Date()
          .toISOString(),

      folder_id:
        match.folder?.id,

      folder_path:
        match.folder?.path,

      match_method:
        match.method,

      match_score:
        match.score,

      source_files:
        extracted.evidence.map(
          item => ({
            id:
              item.fileId,

            name:
              item.fileName,

            path:
              item.filePath,

            modified_time:
              item.modifiedTime,

            url:
              item.url,
          }),
        ),
    },
  };
}


/* ============================================================
   PLAN
   ============================================================ */

function buildPlan(
  match: Match,
  extracted: Extracted,
): PlannedUpdate {
  const provider =
    match.provider;

  const profile =
    match.profile
    || {};


  const providerPatch:
    Json = {};

  const profilePatch:
    Json = {};

  const conflicts:
    string[] = [];


  const phoneColumn =
    availableColumn(
      provider,
      [
        "phone",
        "telephone",
        "telefono",
      ],
    );


  const whatsappColumn =
    availableColumn(
      provider,
      [
        "whatsapp",
        "whatsapp_phone",
      ],
    );


  const emailColumn =
    availableColumn(
      provider,
      [
        "email",
        "contact_email",
      ],
    );


  const addressColumn =
    availableColumn(
      provider,
      [
        "address",
        "direccion",
      ],
    );


  const cityColumn =
    availableColumn(
      provider,
      [
        "city",
        "locality",
        "ciudad",
      ],
    );


  const provinceColumn =
    availableColumn(
      provider,
      [
        "province",
        "state",
        "provincia",
      ],
    );


  const postalColumn =
    availableColumn(
      provider,
      [
        "postal_code",
        "zip",
        "zip_code",
        "cp",
      ],
    );


  if (
    phoneColumn
    &&
    extracted.phones.length
  ) {
    const existing =
      provider[
        phoneColumn
      ];


    if (
      !isEmpty(
        existing,
      )
      &&
      !extracted.phones.includes(
        normalizePhone(
          String(
            existing,
          ),
        ),
      )
    ) {
      conflicts.push(
        `PHONE existing=${existing} drive=${extracted.phones.join("|")}`,
      );
    }


    const selected =
      choose(
        existing,
        extracted.phones,
      );


    if (
      selected
      !== existing
    ) {
      providerPatch[
        phoneColumn
      ] =
        selected;
    }
  }


  if (
    whatsappColumn
    &&
    extracted.phones.length
    &&
    isEmpty(
      provider[
        whatsappColumn
      ],
    )
  ) {
    const mobile =
      extracted.phones.find(
        value =>
          /(?:\+34)?[67]/.test(
            value,
          ),
      );


    if (
      mobile
    ) {
      providerPatch[
        whatsappColumn
      ] =
        mobile;
    }
  }


  if (
    emailColumn
    &&
    extracted.emails.length
  ) {
    const existing =
      provider[
        emailColumn
      ];


    if (
      !isEmpty(
        existing,
      )
      &&
      !extracted.emails.includes(
        String(
          existing,
        ).toLowerCase(),
      )
    ) {
      conflicts.push(
        `EMAIL existing=${existing} drive=${extracted.emails.join("|")}`,
      );
    }


    const selected =
      choose(
        existing,
        extracted.emails,
      );


    if (
      selected
      !== existing
    ) {
      providerPatch[
        emailColumn
      ] =
        selected;
    }
  }


  if (
    addressColumn
    &&
    extracted.addresses.length
  ) {
    const existing =
      provider[
        addressColumn
      ];


    const selected =
      choose(
        existing,
        extracted.addresses,
      );


    if (
      selected
      !== existing
    ) {
      providerPatch[
        addressColumn
      ] =
        selected;
    }
  }


  if (
    postalColumn
    &&
    extracted.postalCodes.length
  ) {
    const existing =
      provider[
        postalColumn
      ];


    const selected =
      choose(
        existing,
        extracted.postalCodes,
      );


    if (
      selected
      !== existing
    ) {
      providerPatch[
        postalColumn
      ] =
        selected;
    }
  }


  const city =
    bestCity(
      extracted,
    );


  if (
    cityColumn
    &&
    city
    &&
    (
      FORCE
      ||
      isEmpty(
        provider[
          cityColumn
        ],
      )
    )
  ) {
    providerPatch[
      cityColumn
    ] =
      city;
  }


  const allText =
    lowerText(
      extracted.evidence
        .map(
          item =>
            item.text,
        )
        .join(
          "\n",
        ),
    );


  if (
    provinceColumn
    &&
    allText.includes(
      "valencia",
    )
    &&
    (
      FORCE
      ||
      isEmpty(
        provider[
          provinceColumn
        ],
      )
    )
  ) {
    providerPatch[
      provinceColumn
    ] =
      "Valencia";
  }


  if (
    match.profile
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        profile,
        "source_metadata",
      )
    ) {
      profilePatch.source_metadata =
        mergeSourceMetadata(
          profile.source_metadata,
          match,
          extracted,
        );
    }


    if (
      Object.prototype.hasOwnProperty.call(
        profile,
        "commercial_relationship",
      )
      &&
      extracted.percentages.length
    ) {
      const existing =
        profile
          .commercial_relationship;


      if (
        FORCE
        ||
        isEmpty(
          existing,
        )
      ) {
        profilePatch
          .commercial_relationship =
          `Referencia encontrada en Drive: ${extracted.percentages.join(", ")}`;
      }
    }


    if (
      Object.prototype.hasOwnProperty.call(
        profile,
        "factual_notes",
      )
    ) {
      const notes:
        string[] = [];


      if (
        extracted.percentages.length
      ) {
        notes.push(
          `Porcentajes/acuerdos detectados: ${extracted.percentages.join(", ")}.`,
        );
      }


      if (
        extracted.websites.length
      ) {
        notes.push(
          `Webs detectadas: ${extracted.websites.join(", ")}.`,
        );
      }


      if (
        notes.length
      ) {
        const old =
          String(
            profile.factual_notes
            || "",
          );


        const syncNote =
          notes.join(
            " ",
          );


        if (
          !old.includes(
            syncNote,
          )
        ) {
          profilePatch
            .factual_notes =
            old
              ? `${old}\n${syncNote}`
              : syncNote;
        }
      }
    }
  }


  const changed =
    Object.keys(
      providerPatch,
    ).length > 0
    ||
    Object.keys(
      profilePatch,
    ).length > 0;


  return {
    providerId:
      String(
        provider.id,
      ),

    providerName:
      displayProviderName(
        provider,
      ),

    folderId:
      match.folder?.id,

    folderPath:
      match.folder?.path,

    matchScore:
      match.score,

    matchMethod:
      match.method,

    providerPatch,
    profilePatch,

    extracted: {
      phones:
        extracted.phones,

      emails:
        extracted.emails,

      postalCodes:
        extracted.postalCodes,

      addresses:
        extracted.addresses,

      percentages:
        extracted.percentages,

      websites:
        extracted.websites,
    },

    sourceFiles:
      extracted.evidence
        .map(
          item => ({
            id:
              item.fileId,

            name:
              item.fileName,

            path:
              item.filePath,

            modifiedTime:
              item.modifiedTime,
          }),
        ),

    conflicts,

    changed,
  };
}


/* ============================================================
   HISTORY
   ============================================================ */

async function tryHistory(
  provider: Json,
  plan: PlannedUpdate,
) {
  try {
    const samples =
      await supabaseGet(
        "crm_entity_history",
        "?select=*&limit=1",
      );


    const columns =
      new Set(
        Object.keys(
          samples[0]
          || {},
        ),
      );


    const row:
      Json = {};


    function put(
      key: string,
      value: any,
    ) {
      if (
        columns.has(
          key,
        )
      ) {
        row[key] =
          value;
      }
    }


    put(
      "company_id",
      COMPANY_ID,
    );

    put(
      "entity_type",
      "provider",
    );

    put(
      "provider_id",
      provider.id,
    );

    put(
      "history_type",
      "drive_enrichment",
    );

    put(
      "title",
      "Proveedor enriquecido desde Google Drive",
    );

    put(
      "description",
      `Sincronización documental desde ${plan.folderPath || "Google Drive"}.`,
    );

    put(
      "confidence",
      "source",
    );

    put(
      "metadata",
      {
        drive_folder_id:
          plan.folderId,

        drive_folder_path:
          plan.folderPath,

        source_files:
          plan.sourceFiles,

        extracted:
          plan.extracted,

        patch:
          plan.providerPatch,
      },
    );


    if (
      Object.keys(
        row,
      ).length
      >= 3
    ) {
      await supabaseInsert(
        "crm_entity_history",
        [
          row,
        ],
      );
    }
  }
  catch (
    error
  ) {
    console.warn(
      `HISTORY_WARNING provider=${plan.providerName}:`,
      error instanceof Error
        ? error.message
        : error,
    );
  }
}


/* ============================================================
   MAIN
   ============================================================ */

async function main() {
  await hydrateIntegrationRuntime();

  console.log(
    "MODE=",
    APPLY
      ? "APPLY"
      : "DRY_RUN",
  );

  console.log(
    "FORCE=",
    FORCE
      ? "1"
      : "0",
  );

  console.log(
    "COMPANY_ID=",
    COMPANY_ID,
  );

  console.log(
    "DRIVE_ROOT_ID=",
    DRIVE_ROOT_ID,
  );


  if (
    !supabaseUrl()
    ||
    !supabaseKey()
  ) {
    throw new Error(
      "SUPABASE_AUTH_MISSING",
    );
  }


  const driveToken =
    await getDriveToken();


  console.log(
    "DRIVE_AUTH_OK=1",
  );


  const providers =
    await supabaseGet(
      "crm_providers",
      `?company_id=eq.${encodeURIComponent(
        COMPANY_ID,
      )}&select=*`,
    );


  const profiles =
    await supabaseGet(
      "crm_provider_profiles",
      `?company_id=eq.${encodeURIComponent(
        COMPANY_ID,
      )}&select=*`,
    );


  console.log(
    `PROVIDERS_DB=${providers.length}`,
  );

  console.log(
    `PROFILES_DB=${profiles.length}`,
  );


  const profileMap =
    new Map(
      profiles.map(
        profile => [
          String(
            profile.provider_id,
          ),
          profile,
        ],
      ),
    );


  console.log(
    "CRAWLING_DRIVE=1",
  );


  const tree =
    await crawlDriveTree(
      driveToken,
      DRIVE_ROOT_ID,
    );


  console.log(
    `DRIVE_FOLDERS=${tree.folders.length}`,
  );

  console.log(
    `DRIVE_FILES=${tree.files.length}`,
  );


  const matches:
    Match[] = [];


  for (
    const provider
    of providers
  ) {
    matches.push(
      matchProvider(
        provider,
        profileMap.get(
          String(
            provider.id,
          ),
        ),
        tree.folders,
      ),
    );
  }


  const unmatched =
    matches.filter(
      match =>
        !match.folder,
    );


  console.log(
    `MATCHED=${matches.length - unmatched.length}`,
  );

  console.log(
    `UNMATCHED=${unmatched.length}`,
  );


  const plans:
    PlannedUpdate[] = [];


  let docsRead =
    0;


  for (
    let index = 0;
    index < matches.length;
    index++
  ) {
    const match =
      matches[index];


    if (
      !match.folder
    ) {
      plans.push({
        providerId:
          String(
            match.provider.id,
          ),

        providerName:
          displayProviderName(
            match.provider,
          ),

        matchScore:
          match.score,

        matchMethod:
          "none",

        providerPatch:
          {},

        profilePatch:
          {},

        extracted: {
          phones: [],
          emails: [],
          postalCodes: [],
          addresses: [],
          percentages: [],
          websites: [],
        },

        sourceFiles:
          [],

        conflicts: [
          "NO_DRIVE_FOLDER_MATCH",
        ],

        changed:
          false,
      });

      continue;
    }


    const evidence =
      await collectEvidence(
        driveToken,
        match.folder,
        tree.files,
      );


    docsRead +=
      evidence.length;


    const extracted =
      extractFromEvidence(
        evidence,
      );


    const plan =
      buildPlan(
        match,
        extracted,
      );


    plans.push(
      plan,
    );


    console.log(
      `[${index + 1}/${matches.length}] ${plan.providerName}`
      +
      ` folder="${plan.folderPath}"`
      +
      ` score=${plan.matchScore.toFixed(2)}`
      +
      ` docs=${evidence.length}`
      +
      ` phone=${plan.extracted.phones[0] || "-"}`
      +
      ` email=${plan.extracted.emails[0] || "-"}`
      +
      ` changed=${plan.changed ? 1 : 0}`,
    );
  }


  const changed =
    plans.filter(
      plan =>
        plan.changed,
    );


  const conflicts =
    plans.filter(
      plan =>
        plan.conflicts.length,
    );


  const phonesFound =
    plans.filter(
      plan =>
        plan.extracted
          .phones
          .length,
    ).length;


  const emailsFound =
    plans.filter(
      plan =>
        plan.extracted
          .emails
          .length,
    ).length;


  const addressesFound =
    plans.filter(
      plan =>
        plan.extracted
          .addresses
          .length,
    ).length;


  const percentagesFound =
    plans.filter(
      plan =>
        plan.extracted
          .percentages
          .length,
    ).length;


  const report = {
    generated_at:
      new Date()
        .toISOString(),

    mode:
      APPLY
        ? "apply"
        : "dry_run",

    company_id:
      COMPANY_ID,

    drive_root_id:
      DRIVE_ROOT_ID,

    counters: {
      providers:
        providers.length,

      profiles:
        profiles.length,

      drive_folders:
        tree.folders.length,

      drive_files:
        tree.files.length,

      matched:
        matches.length
        -
        unmatched.length,

      unmatched:
        unmatched.length,

      docs_read:
        docsRead,

      phones_found:
        phonesFound,

      emails_found:
        emailsFound,

      addresses_found:
        addressesFound,

      percentages_found:
        percentagesFound,

      changes_planned:
        changed.length,

      conflicts:
        conflicts.length,
    },

    plans,
  };


  const reportPath =
    path.join(
      REPORT_DIR,
      `provider-drive-resync-${STAMP}-${APPLY ? "apply" : "dry-run"}.json`,
    );


  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      report,
      null,
      2,
    ),
  );


  console.log(
    `REPORT=${reportPath}`,
  );


  console.log("");
  console.log(
    "============ RESUMEN ============",
  );

  console.log(
    `PROVIDERS_SCANNED=${providers.length}`,
  );

  console.log(
    `MATCHED=${matches.length - unmatched.length}`,
  );

  console.log(
    `UNMATCHED=${unmatched.length}`,
  );

  console.log(
    `DOCS_READ=${docsRead}`,
  );

  console.log(
    `PHONES_FOUND=${phonesFound}`,
  );

  console.log(
    `EMAILS_FOUND=${emailsFound}`,
  );

  console.log(
    `ADDRESSES_FOUND=${addressesFound}`,
  );

  console.log(
    `COMMERCIAL_DATA_FOUND=${percentagesFound}`,
  );

  console.log(
    `CHANGES_PLANNED=${changed.length}`,
  );

  console.log(
    `CONFLICTS=${conflicts.length}`,
  );


  if (
    !APPLY
  ) {
    console.log(
      "UPDATED=0",
    );

    console.log(
      "DRY_RUN_COMPLETE=1",
    );

    return;
  }


  const backupPath =
    path.join(
      BACKUP_DIR,
      `providers-before-resync-${STAMP}.json`,
    );


  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        providers,
        profiles,
      },
      null,
      2,
    ),
  );


  console.log(
    `BACKUP=${backupPath}`,
  );


  let updated =
    0;

  let failed =
    0;


  for (
    const plan
    of changed
  ) {
    try {
      if (
        Object.keys(
          plan.providerPatch,
        ).length
      ) {
        await supabasePatch(
          "crm_providers",
          `id=eq.${encodeURIComponent(
            plan.providerId,
          )}`,
          plan.providerPatch,
        );
      }


      if (
        Object.keys(
          plan.profilePatch,
        ).length
      ) {
        await supabasePatch(
          "crm_provider_profiles",
          `provider_id=eq.${encodeURIComponent(
            plan.providerId,
          )}`,
          plan.profilePatch,
        );
      }


      const provider =
        providers.find(
          item =>
            String(
              item.id,
            )
            === plan.providerId,
        );


      if (
        provider
      ) {
        await tryHistory(
          provider,
          plan,
        );
      }


      updated++;


      console.log(
        `UPDATED_OK ${plan.providerName}`,
      );
    }
    catch (
      error
    ) {
      failed++;


      console.error(
        `UPDATED_FAIL ${plan.providerName}:`,
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }


  console.log("");
  console.log(
    "============ APPLY ============",
  );

  console.log(
    `UPDATED=${updated}`,
  );

  console.log(
    `FAILED=${failed}`,
  );

  console.log(
    `UNCHANGED=${providers.length - changed.length}`,
  );

  console.log(
    `CONFLICTS=${conflicts.length}`,
  );

  console.log(
    `APPLY_COMPLETE=${failed === 0 ? 1 : 0}`,
  );
}


main()
  .catch(
    error => {
      console.error(
        "FATAL:",
        error instanceof Error
          ? error.stack
          : error,
      );

      process.exitCode =
        1;
    },
  );
