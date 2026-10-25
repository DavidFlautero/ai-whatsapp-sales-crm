export type EventServiceStatus =
  | "pending"
  | "searching"
  | "quoted"
  | "approved"
  | "confirmed"
  | "completed"
  | "cancelled";


export type ContractStatus =
  | "not_required"
  | "pending"
  | "generated"
  | "sent"
  | "signed"
  | "cancelled";


export type EventServiceRequirement = {
  id: string;
  event_id: string;

  category_id?:
    string | null;

  service_name?:
    string | null;

  subcategory?:
    string | null;

  description?:
    string | null;

  quantity?:
    number | null;

  is_required?:
    boolean;

  is_critical?:
    boolean;

  max_budget?:
    number
    | string
    | null;

  service_status?:
    EventServiceStatus;

  responsible_team_member_id?:
    string | null;

  assigned_provider_id?:
    string | null;

  provider_cost?:
    number
    | string
    | null;

  client_price?:
    number
    | string
    | null;

  commercial_terms?:
    string | null;

  deposit_required?:
    number
    | string
    | null;

  deposit_paid?:
    number
    | string
    | null;

  provider_payment_due_date?:
    string | null;

  contract_status?:
    ContractStatus;

  arrival_time?:
    string | null;

  setup_time?:
    string | null;

  technical_needs?:
    string | null;

  operational_notes?:
    string | null;

  priority?:
    number | null;
};


export type EventReadiness = {
  event_id: string;

  total_services:
    number | string;

  closed_services:
    number | string;

  open_services:
    number | string;

  critical_pending:
    number | string;

  without_provider:
    number | string;

  payments_pending:
    number | string;

  readiness_percent:
    number | string;

  critical_ready:
    boolean;
};
