export type AwaitedTable = {
  table: string;
  phones: string[];
  dateColumn: string | null;
};

export type BridgeStatistics = {
  identities: number;
  candidateLinks: number;
  ambiguousMatches: number;
  canonicalTables: number;
};

export type BridgeCandidate = {
  company_id: string;
  candidate_key: string;
  identity_id: string;
  case_id: string | null;
  target_table: string;
  target_id: string;
  match_basis: string;
  confidence: number;
  status: "proposed";
  evidence: Record<string, unknown>;
};
