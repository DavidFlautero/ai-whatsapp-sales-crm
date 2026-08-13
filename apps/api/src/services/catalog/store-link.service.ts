import {
  createHmac,
  randomUUID,
} from "node:crypto";

export type StoreLinkReply = {
  handled: boolean;
  text: string | null;
  mode:
    | "wholesale"
    | "retail"
    | null;
  category:
    | string
    | null;
  url:
    | string
    | null;
};

const STORE_LINK_TTL_SECONDS =
  15 * 60;

function base64Url(
  value: string | Buffer,
) {
  return Buffer
    .from(value)
    .toString("base64url");
}

function storeSigningSecret() {
  const secret =
    process.env.STORE_LINK_SECRET
      ?.trim();

  if (!secret) {
    throw new Error(
      "STORE_LINK_SECRET_REQUIRED",
    );
  }

  return secret;
}

function createStoreEntryToken(
  mode:
    | "wholesale"
    | "retail",
) {
  const now =
    Math.floor(
      Date.now() / 1000,
    );

  const header = {
    alg:
      "HS256",

    typ:
      "JWT",
  };

  const payload = {
    iss:
      "fulanitas-store-link",

    aud:
      "fulanitas-store-entry",

    companyId:
      "fulanitas",

    mode,

    iat:
      now,

    exp:
      now
      + STORE_LINK_TTL_SECONDS,

    jti:
      randomUUID(),
  };

  const encodedHeader =
    base64Url(
      JSON.stringify(
        header,
      ),
    );

  const encodedPayload =
    base64Url(
      JSON.stringify(
        payload,
      ),
    );

  const unsigned =
    `${encodedHeader}.${encodedPayload}`;

  const signature =
    createHmac(
      "sha256",
      storeSigningSecret(),
    )
      .update(
        unsigned,
      )
      .digest(
        "base64url",
      );

  return `${unsigned}.${signature}`;
}

const STORE_BASE_URL =
  (
    process.env.STORE_PUBLIC_URL
    || "https://panel.fulanitasfabrica.site"
  ).replace(
    /\/+$/,
    "",
  );

function normalize(
  value:
    unknown,
) {
  return String(
    value
    ?? "",
  )
    .trim()
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /\p{Diacritic}/gu,
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

type AliasDefinition = {
  category: string;
  aliases: string[];
};

const CATEGORY_ALIASES:
  AliasDefinition[] = [
    {
      category:
        "PANTALONES",

      aliases: [
        "pantalon",
        "pantalones",
        "jean",
        "jeans",
        "denim",
        "palazzo",
        "palazzos",
      ],
    },

    {
      category:
        "CAMISETAS",

      aliases: [
        "camiseta",
        "camisetas",
      ],
    },

    {
      category:
        "REMERAS",

      aliases: [
        "remera",
        "remeras",
      ],
    },

    {
      category:
        "MUSCULOSAS",

      aliases: [
        "musculosa",
        "musculosas",
      ],
    },

    {
      category:
        "TOPS",

      aliases: [
        "top",
        "tops",
      ],
    },

    {
      category:
        "SHORTS",

      aliases: [
        "short",
        "shorts",
        "short pollera",
        "shorts pollera",
      ],
    },

    {
      category:
        "POLLERAS",

      aliases: [
        "pollera",
        "polleras",
        "falda",
        "faldas",
      ],
    },

    {
      category:
        "CALZAS",

      aliases: [
        "calza",
        "calzas",
        "legging",
        "leggings",
      ],
    },

    {
      category:
        "CAMPERAS",

      aliases: [
        "campera",
        "camperas",
        "chaqueta",
        "chaquetas",
      ],
    },

    {
      category:
        "BUZOS",

      aliases: [
        "buzo",
        "buzos",
        "hoodie",
        "hoodies",
      ],
    },

    {
      category:
        "SWEATERS",

      aliases: [
        "sweater",
        "sweaters",
        "sueter",
        "sueters",
      ],
    },

    {
      category:
        "SACOS",

      aliases: [
        "saco",
        "sacos",
        "blazer",
        "blazers",
      ],
    },

    {
      category:
        "CHALECOS",

      aliases: [
        "chaleco",
        "chalecos",
      ],
    },

    {
      category:
        "VESTIDOS",

      aliases: [
        "vestido",
        "vestidos",
      ],
    },

    {
      category:
        "MONOS",

      aliases: [
        "mono",
        "monos",
        "monito",
        "monitos",
      ],
    },

    {
      category:
        "CONJUNTOS",

      aliases: [
        "conjunto",
        "conjuntos",
        "set",
        "sets",
      ],
    },

    {
      category:
        "BIKINIS",

      aliases: [
        "bikini",
        "bikinis",
        "malla",
        "mallas",
      ],
    },

    {
      category:
        "ACCESORIOS",

      aliases: [
        "accesorio",
        "accesorios",
        "cinto",
        "cintos",
        "cinturon",
        "cinturones",
      ],
    },
  ];

const CATALOG_PATTERNS = [
  /\bcatalogo\b/,
  /\btienda\b/,
  /\bproductos\b/,
  /\bmodelos\b/,
  /\bcoleccion\b/,
  /\bcolecciones\b/,
  /\bropa\b/,
  /\bprendas\b/,
  /\bque tienen\b/,
  /\bque tenes\b/,
  /\bque hay\b/,
  /\bmostrame\b/,
  /\bmostrarme\b/,
  /\bmandame\b/,
  /\bpasame\b/,
  /\bver catalogo\b/,
];

function containsAlias(
  message:
    string,

  alias:
    string,
) {
  const escaped =
    alias.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  return new RegExp(
    `(?:^|\\s)${escaped}(?:$|\\s)`,
  ).test(
    message,
  );
}

function detectCategory(
  message:
    string,
) {
  for (
    const definition
    of CATEGORY_ALIASES
  ) {
    if (
      definition.aliases.some(
        (alias) =>
          containsAlias(
            message,
            alias,
          ),
      )
    ) {
      return definition.category;
    }
  }

  return null;
}

function detectMode(
  currentMessage:
    string,

  conversationHistory:
    string,
):
  | "wholesale"
  | "retail"
  | null {
  const current =
    normalize(
      currentMessage,
    );

  if (
    /\b(minorista|por menor|minor)\b/
      .test(
        current,
      )
  ) {
    return "retail";
  }

  if (
    /\b(mayorista|por mayor|mayor)\b/
      .test(
        current,
      )
  ) {
    return "wholesale";
  }

  /*
   * Miramos solamente una porción reciente
   * del historial para no arrastrar una
   * intención vieja eternamente.
   */
  const history =
    normalize(
      conversationHistory,
    )
      .slice(
        -2500,
      );

  const retailIndex =
    Math.max(
      history.lastIndexOf(
        "minorista",
      ),
      history.lastIndexOf(
        "por menor",
      ),
  );

  const wholesaleIndex =
    Math.max(
      history.lastIndexOf(
        "mayorista",
      ),
      history.lastIndexOf(
        "por mayor",
      ),
  );

  if (
    retailIndex >= 0
    || wholesaleIndex >= 0
  ) {
    return retailIndex >
      wholesaleIndex
      ? "retail"
      : "wholesale";
  }

  /*
   * Fulanitas trabaja principalmente
   * el canal mayorista.
   */
  return "wholesale";
}

function isCatalogRequest(
  message:
    string,

  category:
    string | null,
) {
  if (category) {
    return true;
  }

  return CATALOG_PATTERNS.some(
    (pattern) =>
      pattern.test(
        message,
      ),
  );
}

function categoryLabel(
  category:
    string,
) {
  return category
    .toLocaleLowerCase(
      "es-AR",
    )
    .replace(
      /(^|\s)\p{L}/gu,
      (match) =>
        match.toUpperCase(),
    );
}


/* ========================================================
   STORE_LINK_RENEWAL_V1

   Si el cliente avisa que un enlace anterior ya no abre,
   NO dejamos que el modelo improvise una URL.

   Renovamos pasando otra vez por buildStoreLinkReply(),
   que es la única autoridad para generar acceso a tienda.
   ======================================================== */

function hasPreviousStoreAccessLink(
  history:
    string,
): boolean {
  const recent =
    String(
      history
      ?? "",
    )
      .slice(
        -8000,
      )
      .replace(
        /\\&/g,
        "&",
      )
      .replace(
        /&amp;/gi,
        "&",
      );

  return (
    /\/tienda\/acceso\?t=/i
      .test(
        recent,
      )
  );
}


function isStoreLinkRenewalRequest(
  normalizedMessage:
    string,
): boolean {
  const message =
    normalizedMessage
      .trim();


  return [
    /\bya no entra\b/,
    /\bno entra\b/,
    /\bno abre\b/,
    /\bno me abre\b/,
    /\bno funciona\b/,
    /\bno anda\b/,
    /\bno sirve\b/,
    /\bno me deja entrar\b/,
    /\bno puedo entrar\b/,
    /\bme da error\b/,
    /\bme sale error\b/,
    /\blink vencio\b/,
    /\blink vencido\b/,
    /\benlace vencio\b/,
    /\benlace vencido\b/,
    /\bexpirado\b/,
    /\bcaduco\b/,
    /\botro link\b/,
    /\botro enlace\b/,
    /\blink nuevo\b/,
    /\benlace nuevo\b/,
    /\bpasame de nuevo el link\b/,
    /\bpasame de nuevo el enlace\b/,
    /\bmandame otro link\b/,
    /\bmandame otro enlace\b/,
  ].some(
    (pattern) =>
      pattern.test(
        message,
      ),
  );
}


function extractLastStoreCategory(
  history:
    string,
): string | null {
  const normalizedHistory =
    String(
      history
      ?? "",
    )
      .replace(
        /\\&/g,
        "&",
      )
      .replace(
        /&amp;/gi,
        "&",
      );


  const matches =
    Array.from(
      normalizedHistory
        .matchAll(
          /[?&]categoria=([^&\s)\]>"']+)/gi,
        ),
    );


  if (
    matches.length === 0
  ) {
    return null;
  }


  const last =
    matches[
      matches.length - 1
    ];


  const raw =
    last?.[1]
    ?? "";


  if (!raw) {
    return null;
  }


  try {
    return decodeURIComponent(
      raw,
    )
      .trim()
      .toUpperCase()
      || null;
  } catch {
    return raw
      .trim()
      .toUpperCase()
      || null;
  }
}


export function buildStoreLinkReply(
  input: {
    message: string;
    conversationHistory?: string;
  },
): StoreLinkReply {
  const normalized =
    normalize(
      input.message,
    );


  /* STORE LINK RENEWAL EARLY RETURN */
  const renewalHistory =
    input.conversationHistory
    ?? "";


  if (
    hasPreviousStoreAccessLink(
      renewalHistory,
    )
    && isStoreLinkRenewalRequest(
      normalized,
    )
  ) {
    const previousCategory =
      extractLastStoreCategory(
        renewalHistory,
      );


    /*
     * detectMode ya conoce el historial.
     * Si no encuentra información explícita,
     * Fulanitas mantiene mayorista como default.
     */
    const previousMode =
      detectMode(
        "",
        renewalHistory,
      )
      ?? "wholesale";


    /*
     * IMPORTANTE:
     * volvemos a entrar por ESTA MISMA función.
     *
     * No construimos /tienda/mayorista
     * ni /tienda/minorista manualmente.
     *
     * Así el mecanismo de firma existente
     * genera un token NUEVO.
     */
    const baseReply =
      buildStoreLinkReply({
        message:
          previousMode === "retail"
            ? "catalogo minorista"
            : "catalogo mayorista",

        conversationHistory:
          renewalHistory,
      });


    if (
      baseReply.handled
      && baseReply.url
    ) {
      const renewed =
        new URL(
          baseReply.url,
        );


      /*
       * categoria no forma parte del token;
       * /tienda/acceso ya sabe conservarla
       * durante el canje.
       */
      if (previousCategory) {
        renewed
          .searchParams
          .set(
            "categoria",
            previousCategory,
          );
      }


      const renewedUrl =
        renewed.toString();


      console.log(
        "[STORE LINK RENEWED]",
        {
          mode:
            baseReply.mode
            ?? previousMode,

          category:
            previousCategory,

          signed:
            renewedUrl.includes(
              "/tienda/acceso?t=",
            ),
        },
      );


      return {
        handled:
          true,

        mode:
          baseReply.mode
          ?? previousMode,

        category:
          previousCategory,

        url:
          renewedUrl,

        text: [
          "Sí 👍 Ese enlace ya no sirve. Te genero uno nuevo:",
          "",
          renewedUrl,
          "",
          previousCategory
            ? "Te abre nuevamente la categoría que estabas viendo."
            : "Te abre nuevamente el catálogo.",
        ].join(
          "\n",
        ),
      };
    }
  }

  const category =
    detectCategory(
      normalized,
    );

  if (
    !isCatalogRequest(
      normalized,
      category,
    )
  ) {
    return {
      handled:
        false,

      text:
        null,

      mode:
        null,

      category:
        null,

      url:
        null,
    };
  }

  const mode =
    detectMode(
      input.message,
      input.conversationHistory
      ?? "",
    )
    ?? "wholesale";

  const params =
    new URLSearchParams();

  params.set(
    "t",
    createStoreEntryToken(
      mode,
    ),
  );

  if (category) {
    params.set(
      "categoria",
      category,
    );
  }

  const url =
    `${STORE_BASE_URL}/tienda/acceso?${params.toString()}`;

  if (category) {
    const label =
      categoryLabel(
        category,
      );

    return {
      handled:
        true,

      mode,

      category,

      url,

      text: [
        `Sí 👍 Te paso ${
          label
        } disponibles acá:`,
        "",
        url,
        "",
        mode === "wholesale"
          ? "Entrá al catálogo, elegí lo que necesitás y armá el pedido. Al finalizar volvés directo por WhatsApp."
          : "Entrá al catálogo, elegí tus productos y armá el pedido. Al finalizar volvés directo por WhatsApp.",
      ].join(
        "\n",
      ),
    };
  }

  return {
    handled:
      true,

    mode,

    category:
      null,

    url,

    text: [
      mode === "wholesale"
        ? "Sí 👍 Te paso el catálogo mayorista completo:"
        : "Sí 👍 Te paso la tienda minorista:",

      "",

      url,

      "",

      "Podés ver las categorías, elegir los productos y armar el pedido ahí. Al finalizar volvés directo por WhatsApp.",
    ].join(
      "\n",
    ),
  };
}
