export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const raw = value.trim();

  if (/@g\.us$/i.test(raw)) return null;

  const phone = raw
    .replace(/@(?:s\.whatsapp\.net|c\.us)$/i, "")
    .replace(/[\s()+.\-]/g, "");

  return /^[0-9]{8,15}$/.test(phone)
    ? phone
    : null;
}

export function redactPhone(phone: string): string {
  return "***" + phone.slice(-4);
}
