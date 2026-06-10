export const logger = {
  info: (message: string, meta?: unknown) => console.log(message, meta ?? ""),
  error: (message: string, meta?: unknown) => console.error(message, meta ?? "")
};
