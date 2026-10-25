import { Supabase } from "./supabase.js";

export type EntityLink = {
  companyId: string;
  identityId: string;
  targetType:
    | "crm_contact"
    | "crm_customer"
    | "crm_owner"
    | "crm_supplier"
    | "venue";
  targetId: string;
  evidenceMessageId: string;
  confidence: number;
};

export async function proposeEntityLink(
  db: Supabase,
  args: EntityLink,
): Promise<void> {
  if (
    !args.targetId.trim() ||
    args.confidence < 0.9
  ) {
    throw new Error(
      "INSUFFICIENT_ENTITY_LINK_EVIDENCE",
    );
  }

  await db.insertIgnore(
    "crm_memory_entity_links",
    {
      company_id: args.companyId,
      identity_id: args.identityId,
      target_type: args.targetType,
      target_id: args.targetId,
      status: "proposed",
      confidence: confidenceValue(
        args.confidence,
      ),
      evidence_message_id:
        args.evidenceMessageId,
    },
    "company_id,identity_id,target_type,target_id",
  );
}

function confidenceValue(n: number): number {
  return Math.round(
    Math.max(0, Math.min(1, n)) * 1000,
  ) / 1000;
}
