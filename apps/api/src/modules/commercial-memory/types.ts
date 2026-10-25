export type Role =
  | "customer"
  | "owner"
  | "supplier"
  | "organizer";

export type MessageDirection =
  | "inbound"
  | "outbound";

export type Intent =
  | "event_inquiry"
  | "owner_offer"
  | "supplier_offer"
  | "noncommercial"
  | "other";

export type Message = {
  id: string;
  company_id: string;
  contact_phone: string | null;
  body: string | null;
  direction: MessageDirection;
  message_type: string;
  occurred_at: string;
  created_at: string;
  external_message_id?: string | null;
};

export type Identity = {
  id: string;
  company_id: string;
  primary_phone: string;
  display_name?: string | null;
  identity_status: string;
};

export type CommercialCase = {
  id: string;
  company_id: string;
  case_key: string;
  customer_identity_id: string;
  event_date: string | null;
  event_type: string | null;
  venue_label: string | null;
  state: string;
  last_activity_at: string;
  crm_lead_id?: string | null;
  crm_event_id?: string | null;
};

export type Signal = {
  intent: Intent;
  role: Role | "unknown";
  eventDate: string | null;
  eventType: string | null;
  venueMention: string | null;
  attendees: number | null;
  quotedAmountEur: number | null;
  potentialAcceptance: boolean;
  confidence: number;
  evidenceQuote: string | null;
};

export type CommercialFact = {
  factType: string;
  value: Record<string, unknown>;
  confidence: number;
};

export type ReviewType =
  | "possible_booking_confirmation"
  | "owner_case_link_candidate"
  | "ambiguous_case_match"
  | "role_ambiguity"
  | "missing_contact"
  | "sensitive_action_required";
