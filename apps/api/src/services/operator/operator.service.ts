import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type Assignment = {
  contact_phone: string;
  status: "ai" | "human" | "paused";
  assigned_to?: string;
  reason?: string;
};

const assignments = new Map<string, Assignment>();

export async function setOperatorMode(input: Assignment) {
  const row = {
    ...input,
    updated_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    assignments.set(input.contact_phone, input);
    return input;
  }

  const rows = await supabaseRequest<Assignment[]>({
    table: "operator_assignments",
    method: "POST",
    query: "?on_conflict=contact_phone",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [row]
  });

  return rows[0];
}

export async function getOperatorMode(phone: string) {
  if (!isSupabaseConfigured()) {
    return assignments.get(phone) ?? { contact_phone: phone, status: "ai" };
  }

  const rows = await supabaseRequest<Assignment[]>({
    table: "operator_assignments",
    query: `?contact_phone=eq.${encodeURIComponent(phone)}&select=*&limit=1`
  });

  return rows[0] ?? { contact_phone: phone, status: "ai" };
}

export async function listOperatorAssignments() {
  if (!isSupabaseConfigured()) return Array.from(assignments.values());

  return supabaseRequest<Assignment[]>({
    table: "operator_assignments",
    query: "?select=*&order=updated_at.desc"
  });
}
