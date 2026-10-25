export const INTEL_VERSION = "commercial-intel-v2";

export type CommercialMove =
  | "question"
  | "quote_request"
  | "offer"
  | "counteroffer"
  | "availability"
  | "acceptance_claim"
  | "payment_claim"
  | "rejection"
  | "information"
  | "other";

export type PriceRole =
  | "owner_cost"
  | "supplier_cost"
  | "customer_price"
  | "deposit"
  | "unknown";

export type AIObservation = {
  actor_role:
    | "customer"
    | "owner"
    | "supplier"
    | "organizer"
    | "unknown";

  intent:
    | "event_inquiry"
    | "owner_offer"
    | "supplier_offer"
    | "other";

  commercial_move: CommercialMove;
  event_date: string | null;
  event_type: string | null;
  venue_mention: string | null;
  attendees: number | null;
  amount_eur: number | null;
  price_role: PriceRole;
  evidence_quote: string | null;
  recommended_action: string | null;
  confidence: number;
};

export type IntelCursor = {
  time: string;
  id: string;
};
