export async function getAdminOverview() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const res = await fetch(`${baseUrl}/admin/overview`, {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("Failed to load admin overview");
  }

  return res.json();
}
