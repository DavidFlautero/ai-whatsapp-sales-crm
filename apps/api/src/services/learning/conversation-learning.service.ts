import {
  ensureRuntimeAccess,
} from "../runtime/core-state.service.js";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  promises as fs,
} from "node:fs";

import path from "node:path";

import {
  createKnowledgeItem,
} from "../knowledge/knowledge.repository.js";

import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";


const COMPANY_ID =
  "fulanitas";

const STATE_PATH =
  path.resolve(
    process.cwd(),
    "data/learning/fulanitas-learning.json",
  );

const MAX_RUNS =
  11;

const DAILY_RUNS =
  8;


/*
 * 8 días consecutivos.
 * Luego días 15, 22 y 29.
 */
const OFFSETS_DAYS = [
  0, 1, 2, 3,
  4, 5, 6, 7,
  14, 21, 28,
] as const;


type LearningState = {
  companyId: string;

  activatedAt:
    string;

  completedRuns:
    number;

  lastRunAt:
    string | null;

  lastProcessedAt:
    string | null;

  status:
    | "active"
    | "completed";

  signature:
    string;
};


type MessageRow = {
  id?: string;

  contact_phone?:
    string;

  direction?:
    string;

  body?:
    string | null;

  created_at?:
    string;

  channel?:
    string;
};


type LearningItem = {
  title:
    string;

  content:
    string;

  tags:
    string[];

  evidence:
    string;

  kind?:
    | "behavior_rule"
    | "faq_gap"
    | "business_fact"
    | "transactional_issue";
};


type LearningAnalysis = {
  summary:
    string;

  items:
    LearningItem[];
};


function secret() {
  const value =
    process.env
      .LEARNING_LICENSE_SECRET
      ?.trim();

  if (!value) {
    throw new Error(
      "LEARNING_LICENSE_SECRET_REQUIRED",
    );
  }

  return value;
}


function unsignedState(
  state:
    Omit<
      LearningState,
      "signature"
    >,
) {
  return JSON.stringify({
    companyId:
      state.companyId,

    activatedAt:
      state.activatedAt,

    completedRuns:
      state.completedRuns,

    lastRunAt:
      state.lastRunAt,

    lastProcessedAt:
      state.lastProcessedAt,

    status:
      state.status,
  });
}


function signState(
  state:
    Omit<
      LearningState,
      "signature"
    >,
) {
  return createHmac(
    "sha256",
    secret(),
  )
    .update(
      unsignedState(
        state,
      ),
      "utf8",
    )
    .digest(
      "hex",
    );
}


function verifyState(
  state:
    LearningState,
) {
  const {
    signature,
    ...unsigned
  } = state;

  const expected =
    signState(
      unsigned,
    );

  const left =
    Buffer.from(
      signature,
      "hex",
    );

  const right =
    Buffer.from(
      expected,
      "hex",
    );

  if (
    left.length
      !== right.length
    || !timingSafeEqual(
      left,
      right,
    )
  ) {
    throw new Error(
      "LEARNING_LICENSE_INVALID",
    );
  }
}


async function saveState(
  input:
    Omit<
      LearningState,
      "signature"
    >,
) {
  await fs.mkdir(
    path.dirname(
      STATE_PATH,
    ),
    {
      recursive:
        true,
    },
  );

  const state:
    LearningState = {
    ...input,

    signature:
      signState(
        input,
      ),
  };

  await fs.writeFile(
    STATE_PATH,
    JSON.stringify(
      state,
      null,
      2,
    ),
    "utf8",
  );

  return state;
}


async function loadState() {
  try {
    const raw =
      await fs.readFile(
        STATE_PATH,
        "utf8",
      );

    const state =
      JSON.parse(
        raw,
      ) as LearningState;

    verifyState(
      state,
    );

    return state;
  } catch (
    error
  ) {
    if (
      error instanceof Error
      && (
        error.message
          === "LEARNING_LICENSE_INVALID"
      )
    ) {
      throw error;
    }

    return null;
  }
}


export async function activateLearning() {
  const existing =
    await loadState();

  if (existing) {
    return existing;
  }

  const now =
    new Date()
      .toISOString();

  return saveState({
    companyId:
      COMPANY_ID,

    activatedAt:
      now,

    completedRuns:
      0,

    lastRunAt:
      null,

    lastProcessedAt:
      now,

    status:
      "active",
  });
}


function scheduledAt(
  state:
    LearningState,
) {
  const index =
    state.completedRuns;

  if (
    index >= MAX_RUNS
  ) {
    return null;
  }

  const activated =
    new Date(
      state.activatedAt,
    );

  return new Date(
    activated.getTime()
    + OFFSETS_DAYS[index]
      * 86400000,
  );
}


function dueNow(
  state:
    LearningState,
) {
  const scheduled =
    scheduledAt(
      state,
    );

  if (!scheduled) {
    return false;
  }

  return (
    Date.now()
    >= scheduled.getTime()
  );
}


async function loadConversationMessages(
  since:
    string,
) {
  const rows =
    await supabaseRequest<
      MessageRow[]
    >({
      table:
        "messages",

      query:
        `?company_id=eq.${encodeURIComponent(COMPANY_ID)}`
        + "&channel=eq.whatsapp"
        + `&created_at=gte.${encodeURIComponent(since)}`
        + "&select=id,contact_phone,direction,body,created_at,channel"
        + "&order=created_at.asc"
        + "&limit=1000",
    });

  return rows
    .filter(
      (row) =>
        Boolean(
          row.body
            ?.trim(),
        ),
    );
}


function redact(
  text:
    string,
) {
  return text
    .replace(
      /https?:\/\/[^\s]+/gi,
      "[LINK]",
    )
    .replace(
      /\b\d{8,15}\b/g,
      "[PHONE]",
    )
    .replace(
      /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
      "[EMAIL]",
    );
}


function transcript(
  rows:
    MessageRow[],
) {
  return rows
    .slice(
      -600,
    )
    .map(
      (row) => {
        const role =
          row.direction
          === "inbound"
            ? "CLIENTE"
            : "AGENTE";

        return (
          `${role}: `
          + redact(
            row.body
            ?.trim()
            ?? "",
          )
        );
      },
    )
    .join(
      "\n",
    )
    .slice(
      0,
      70000,
    );
}


function extractJson(
  text:
    string,
) {
  let clean =
    text
      .trim();

  /*
   * Quitar fences markdown si existen.
   */
  clean =
    clean
      .replace(
        /^```(?:json)?\s*/i,
        "",
      )
      .replace(
        /\s*```$/i,
        "",
      )
      .trim();

  /*
   * Intento directo.
   */
  try {
    return JSON.parse(
      clean,
    ) as LearningAnalysis;
  } catch {
    // seguimos buscando objeto embebido
  }

  /*
   * Buscar el primer objeto JSON balanceado.
   * Esto tolera frases tipo:
   * "Acá está el resultado: { ... }"
   */
  let start =
    -1;

  let depth =
    0;

  let inString =
    false;

  let escaped =
    false;

  for (
    let index = 0;
    index < clean.length;
    index += 1
  ) {
    const char =
      clean[index];

    if (escaped) {
      escaped =
        false;

      continue;
    }

    if (
      char === "\\\\"
      && inString
    ) {
      escaped =
        true;

      continue;
    }

    if (
      char === '"'
    ) {
      inString =
        !inString;

      continue;
    }

    if (inString) {
      continue;
    }

    if (
      char === "{"
    ) {
      if (
        depth === 0
      ) {
        start =
          index;
      }

      depth += 1;

      continue;
    }

    if (
      char === "}"
      && depth > 0
    ) {
      depth -= 1;

      if (
        depth === 0
        && start >= 0
      ) {
        const candidate =
          clean.slice(
            start,
            index + 1,
          );

        try {
          return JSON.parse(
            candidate,
          ) as LearningAnalysis;
        } catch {
          start =
            -1;
        }
      }
    }
  }

  throw new Error(
    "LEARNING_JSON_NOT_FOUND",
  );
}


function validateAnalysis(
  value:
    LearningAnalysis,
) {
  if (
    !value
    || !Array.isArray(
      value.items,
    )
  ) {
    throw new Error(
      "LEARNING_INVALID_ANALYSIS",
    );
  }

  const forbiddenPatterns = [
    /\bprecio\s*[:=]\s*\d/i,
    /\bstock\s*[:=]\s*\d/i,
    /\bcuenta bancaria\b/i,
    /\bcbu\b/i,
    /\balias bancario\b/i,
    /\btoken\b/i,
    /\bapi[_ -]?key\b/i,
    /\bcontraseña\b/i,
  ];

  const safeItems =
    value.items
      .filter(
        (item) =>
          item
          && typeof item.title
            === "string"
          && typeof item.content
            === "string",
      )
      .map(
        (item) => ({
          title:
            item.title
              .trim()
              .slice(
                0,
                160,
              ),

          content:
            item.content
              .trim()
              .slice(
                0,
                1800,
              ),

          tags:
            Array.isArray(
              item.tags,
            )
              ? item.tags
                  .filter(
                    (tag) =>
                      typeof tag
                      === "string",
                  )
                  .slice(
                    0,
                    8,
                  )
              : [],

          evidence:
            typeof item.evidence
            === "string"
              ? item.evidence
                  .trim()
                  .slice(
                    0,
                    180,
                  )
              : "",

          kind:
            item.kind
            === "behavior_rule"
            || item.kind
            === "faq_gap"
            || item.kind
            === "business_fact"
            || item.kind
            === "transactional_issue"
              ? item.kind
              : "faq_gap",
        }),
      )
      .filter(
        (item) =>
          item.title.length
            >= 4
          && item.content.length
            >= 20,
      )
      .filter(
        (item) =>
          !forbiddenPatterns
            .some(
              (pattern) =>
                pattern.test(
                  item.content,
                ),
            ),
      )
      .slice(
        0,
        6,
      );

  return {
    summary:
      typeof value.summary
      === "string"
        ? value.summary
            .slice(
              0,
              1500,
            )
        : "",

    items:
      safeItems,
  };
}


async function generateLearningAnalysis(
  prompt:
    string,
) {
  const apiKey =
    process.env
      .ANTHROPIC_API_KEY
      ?.trim();

  const model =
    process.env
      .ANTHROPIC_MODEL
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "LEARNING_ANTHROPIC_API_KEY_REQUIRED",
    );
  }

  if (!model) {
    throw new Error(
      "LEARNING_ANTHROPIC_MODEL_REQUIRED",
    );
  }

  const response =
    await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method:
          "POST",

        headers: {
          "x-api-key":
            apiKey,

          "anthropic-version":
            "2023-06-01",

          "content-type":
            "application/json",
        },

        body:
          JSON.stringify({
            model,

            max_tokens:
              3000,

            system:
              [
                "Sos un analizador interno de calidad.",
                "NO estás hablando con un cliente.",
                "Tu única tarea es analizar conversaciones comerciales.",
                "Respondé únicamente con el JSON solicitado.",
                "No saludes.",
                "No hagas preguntas.",
                "No escribas texto antes ni después del JSON.",
              ].join(
                " ",
              ),

            messages: [
              {
                role:
                  "user",

                content:
                  prompt,
              },
            ],
          }),
      },
    );

  let data:
    any;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      `LEARNING_ANTHROPIC_INVALID_RESPONSE_${response.status}`,
    );
  }

  if (
    !response.ok
  ) {
    const providerMessage =
      typeof data?.error?.message
      === "string"
        ? data.error.message
        : "unknown";

    console.error(
      "[LEARNING ANTHROPIC ERROR]",
      {
        status:
          response.status,

        type:
          data?.error?.type
          ?? null,

        message:
          providerMessage,
      },
    );

    throw new Error(
      `LEARNING_ANTHROPIC_HTTP_${response.status}`,
    );
  }

  const text =
    Array.isArray(
      data?.content,
    )
      ? data.content
          .filter(
            (item: any) =>
              item?.type
              === "text",
          )
          .map(
            (item: any) =>
              String(
                item?.text
                ?? "",
              ),
          )
          .join(
            "\n",
          )
          .trim()
      : "";

  if (!text) {
    console.error(
      "[LEARNING ANTHROPIC EMPTY]",
      {
        stopReason:
          data?.stop_reason
          ?? null,

        contentTypes:
          Array.isArray(
            data?.content,
          )
            ? data.content.map(
                (item: any) =>
                  item?.type
                  ?? "unknown",
              )
            : [],
      },
    );

    throw new Error(
      "LEARNING_ANTHROPIC_EMPTY_RESPONSE",
    );
  }

  return text;
}


async function analyze(
  messages:
    MessageRow[],
) {
  const history =
    transcript(
      messages,
    );

  const prompt = `
Analizá conversaciones reales de atención comercial de Fulanitas.

OBJETIVO:
Extraer aprendizajes generales reutilizables para que el agente responda mejor en conversaciones futuras.

BUSCÁ:
- preguntas recurrentes;
- información empresarial que los clientes necesitan repetidamente;
- respuestas del agente que provocan repreguntas;
- dudas recurrentes;
- errores de comprensión;
- patrones donde el agente pregunta algo que el cliente ya había dicho;
- instrucciones generales que reduzcan fricción.

PROHIBIDO:
- inventar precios;
- aprender precios históricos como verdad permanente;
- aprender cantidades de stock;
- modificar reglas de pedidos;
- modificar cuentas bancarias;
- copiar teléfonos, emails o datos personales;
- guardar secretos;
- cambiar código;
- inferir una política empresarial que no esté sustentada claramente por varias conversaciones.

Solo generá un aprendizaje si existe evidencia repetida o muy clara.

Respondé EXCLUSIVAMENTE JSON válido:

{
  "summary": "resumen corto",
  "items": [
    {
      "title": "título general",
      "content": "regla o conocimiento reutilizable",
      "tags": ["learning", "faq"],
      "evidence": "explicación corta de por qué se detectó",
      "kind": "behavior_rule"
    }
  ]
}

Máximo 6 items.
Cada "content" debe ser corto y operativo.
Cada "evidence" debe tener máximo 180 caracteres.

CLASIFICÁ cada hallazgo obligatoriamente:

behavior_rule:
reglas generales de conversación, contexto, comprensión o UX.

faq_gap:
pregunta frecuente cuya respuesta empresarial todavía debe verificarse.

business_fact:
afirmaciones sobre políticas reales del negocio, horarios, facturación,
modalidad mayorista/minorista, imágenes, envíos, pagos, etc.

transactional_issue:
problemas de pedidos, cancelaciones, comprobantes, pagos,
stock, carrito o captura estructurada.

IMPORTANTE:
Solo behavior_rule podrá aplicarse automáticamente.
No conviertas observaciones del historial en hechos empresariales.
Si no hay aprendizaje seguro:
{"summary":"Sin aprendizajes seguros","items":[]}

CONVERSACIONES:
${history}
`;

  const raw =
    await generateLearningAnalysis(
      prompt,
    );

  if (
    !raw
    || !raw.trim()
  ) {
    throw new Error(
      "LEARNING_EMPTY_AI_RESPONSE",
    );
  }

  /*
   * Nunca imprimimos conversaciones.
   * Solo una vista limitada de la respuesta
   * del analizador para diagnosticar formato.
   */
  console.log(
    "[LEARNING AI RESPONSE PREVIEW]",
    raw
      .replace(
        /https?:\/\/[^\s]+/gi,
        "[LINK]",
      )
      .slice(
        0,
        2500,
      ),
  );

  return validateAnalysis(
    extractJson(
      raw,
    ),
  );
}


async function persistLearning(
  runNumber:
    number,

  analysis:
    LearningAnalysis,
) {
  const created =
    [];

  for (
    const item
    of analysis.items.filter(
      (candidate) =>
        candidate.kind
        === "behavior_rule",
    )
  ) {
    const stored =
      await createKnowledgeItem(
        {
          type:
            "learned_conversation",

          title:
            item.title,

          content:
            item.content,

          tags: [
            ...item.tags,
            "conversation-learning",
          ],

          source:
            "conversation-learning",

          version:
            1,

          active:
            true,

          metadata: {
            learningRun:
              runNumber,

            learningKind:
              item.kind,

            evidence:
              item.evidence,

            learnedAt:
              new Date()
                .toISOString(),

            protectedDomains: [
              "price",
              "stock",
              "payments",
              "orders",
            ],
          },
        },
        COMPANY_ID,
      );

    created.push(
      stored,
    );
  }

  return created;
}


export async function learningStatus() {
  const state =
    await loadState();

  if (!state) {
    return {
      active:
        false,

      reason:
        "not_activated",
    };
  }

  const next =
    scheduledAt(
      state,
    );

  return {
    active:
      state.status
      === "active",

    completedRuns:
      state.completedRuns,

    totalRuns:
      MAX_RUNS,

    phase:
      state.completedRuns
      < DAILY_RUNS
        ? "daily"
        : state.completedRuns
          < MAX_RUNS
            ? "weekly"
            : "completed",

    nextRunAt:
      next
        ?.toISOString()
        ?? null,

    lastRunAt:
      state.lastRunAt,
  };
}


export async function runConversationLearning(
  options?: {
    force?:
      boolean;

    dryRun?:
      boolean;

    lookbackHours?:
      number;
  },
) {

  /* RUNTIME_CHECK_A4 */
  ensureRuntimeAccess("learning");

  let state =
    await loadState();

  if (!state) {
    state =
      await activateLearning();
  }

  if (
    state.status
    === "completed"
    || state.completedRuns
      >= MAX_RUNS
  ) {
    return {
      executed:
        false,

      reason:
        "completed",

      state,
    };
  }

  if (
    !options?.force
    && !dueNow(
      state,
    )
  ) {
    return {
      executed:
        false,

      reason:
        "not_due",

      state,
    };
  }

  const lookbackHours =
    options?.lookbackHours
    && options.lookbackHours > 0
      ? Math.min(
          options.lookbackHours,
          168,
        )
      : null;

  const since =
    lookbackHours
      ? new Date(
          Date.now()
          - lookbackHours
            * 60
            * 60
            * 1000,
        ).toISOString()
      : (
          state.lastProcessedAt
          ?? state.activatedAt
        );

  const messages =
    await loadConversationMessages(
      since,
    );

  const now =
    new Date()
      .toISOString();

  /*
   * Si no hubo suficiente conversación real,
   * consumimos el slot igualmente solo cuando
   * el job programado realmente llegó a su fecha.
   * En dryRun nunca consumimos nada.
   */
  if (
    messages.length < 4
  ) {
    return {
      executed:
        false,

      reason:
        "not_enough_messages",

      messageCount:
        messages.length,

      since,

      state,
    };
  }

  const analysis =
    await analyze(
      messages,
    );

  if (
    options?.dryRun
  ) {
    return {
      executed:
        false,

      dryRun:
        true,

      messageCount:
        messages.length,

      analysis,
    };
  }

  const runNumber =
    state.completedRuns
    + 1;

  const created =
    await persistLearning(
      runNumber,
      analysis,
    );

  const completed =
    runNumber
    >= MAX_RUNS;

  state =
    await saveState({
      companyId:
        state.companyId,

      activatedAt:
        state.activatedAt,

      completedRuns:
        runNumber,

      lastRunAt:
        now,

      lastProcessedAt:
        now,

      status:
        completed
          ? "completed"
          : "active",
    });

  console.log(
    "[CONVERSATION LEARNING RUN]",
    {
      companyId:
        COMPANY_ID,

      runNumber,

      messageCount:
        messages.length,

      learnedItems:
        created.length,

      phase:
        runNumber
        <= DAILY_RUNS
          ? "daily"
          : "weekly",

      completed,
    },
  );

  return {
    executed:
      true,

    runNumber,

    messageCount:
      messages.length,

    learned:
      created.length,

    analysisSummary:
      analysis.summary,

    state,
  };
}
