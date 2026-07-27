export async function handleNinoxWebhook(payload: unknown) {
  console.log("[ninox:webhook]", payload);
  return { ok: true };
}
