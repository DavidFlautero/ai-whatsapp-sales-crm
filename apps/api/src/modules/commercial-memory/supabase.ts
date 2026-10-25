import type { Config } from "./config.js";

export class DbError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(`SUPABASE_${httpStatus}_${code}`);
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "HEAD";
  filters?: Array<[string, string]>;
  body?: unknown;
  onConflict?: string;
  ignoreDuplicates?: boolean;
  returnRepresentation?: boolean;
};

export class Supabase {
  constructor(private readonly cfg: Config) {}

  private url(
    table: string,
    pairs: Array<[string, string]>,
  ): string {
    if (!/^[a-z][a-z0-9_]*$/.test(table)) {
      throw new Error("INVALID_TABLE");
    }

    const url = new URL(
      `${this.cfg.supabaseUrl}/${table}`,
    );

    for (const [key, value] of pairs) {
      url.searchParams.append(key, value);
    }

    return url.toString();
  }

  async request<T>(
    table: string,
    options: Options = {},
  ): Promise<T> {
    const method = options.method || "GET";

    if (
      method !== "GET" &&
      method !== "HEAD" &&
      !this.cfg.writeEnabled
    ) {
      throw new Error("CM_WRITE_DISABLED");
    }

    const filters = [...(options.filters || [])];

    if (options.onConflict) {
      filters.push([
        "on_conflict",
        options.onConflict,
      ]);
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < 4; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        18000,
      );

      try {
        const response = await fetch(
          this.url(table, filters),
          {
            method,
            signal: controller.signal,
            headers: {
              apikey: this.cfg.serviceKey,
              authorization:
                `Bearer ${this.cfg.serviceKey}`,
              "content-type": "application/json",
              prefer: options.onConflict
                ? `resolution=${
                    options.ignoreDuplicates
                      ? "ignore"
                      : "merge"
                  }-duplicates,return=${
                    options.returnRepresentation === false
                      ? "minimal"
                      : "representation"
                  }`
                : `return=${
                    options.returnRepresentation === false
                      ? "minimal"
                      : "representation"
                  }`,
            },
            body:
              method === "POST" || method === "PATCH"
                ? JSON.stringify(options.body)
                : undefined,
          },
        );

        if (response.ok) {
          if (
            method === "HEAD" ||
            response.status === 204 ||
            options.returnRepresentation === false
          ) {
            return undefined as T;
          }

          const body = await response.text();

          return (
            body ? JSON.parse(body) : []
          ) as T;
        }

        const data = await response
          .json()
          .catch(() => ({}));

        const code =
          typeof data?.code === "string"
            ? data.code
            : "HTTP_ERROR";

        lastError = new DbError(
          code,
          response.status,
        );

        if (
          ![408, 429, 500, 502, 503, 504]
            .includes(response.status)
        ) {
          throw lastError;
        }
      } catch (error) {
        lastError = error;

        if (
          error instanceof DbError &&
          ![408, 429, 500, 502, 503, 504]
            .includes(error.httpStatus)
        ) {
          throw error;
        }
      } finally {
        clearTimeout(timer);
      }

      if (attempt < 3) {
        await new Promise(resolve =>
          setTimeout(resolve, (attempt + 1) * 600),
        );
      }
    }

    throw lastError ||
      new Error("SUPABASE_RETRY_EXHAUSTED");
  }

  async rpc<T>(
    fn: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    if (!/^[a-z][a-z0-9_]*$/.test(fn)) {
      throw new Error("INVALID_RPC");
    }

    if (!this.cfg.writeEnabled) {
      throw new Error("CM_WRITE_DISABLED");
    }

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      18000,
    );

    try {
      const response = await fetch(
        `${this.cfg.supabaseUrl}/rpc/${fn}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            apikey: this.cfg.serviceKey,
            authorization:
              `Bearer ${this.cfg.serviceKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new DbError(
          data?.code || "RPC_ERROR",
          response.status,
        );
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(
    table: string,
    filters: Array<[string, string]>,
  ): Promise<T> {
    return this.request<T>(table, { filters });
  }

  insertIgnore<T>(
    table: string,
    body: unknown,
    onConflict: string,
  ): Promise<T> {
    return this.request<T>(table, {
      method: "POST",
      body,
      onConflict,
      ignoreDuplicates: true,
    });
  }

  upsert<T>(
    table: string,
    body: unknown,
    onConflict: string,
  ): Promise<T> {
    return this.request<T>(table, {
      method: "POST",
      body,
      onConflict,
    });
  }
}
