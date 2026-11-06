import {
  listPrompts,
} from "../prompts/prompt.repository.js";

import {
  previewCompanyAgent,
  type CompanyAgentProfile,
  type CompanyHistoryMessage,
} from "./company-agent-runtime.service.js";

const PROFILE_TYPE = "company_agent";

export async function loadCompanyAgentProfile(
  companyId: string
): Promise<CompanyAgentProfile> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(companyId)) {
    throw new Error("INVALID_COMPANY_ID");
  }

  const prompts = await listPrompts(companyId);

  const prompt = prompts.find(
    item =>
      item.company_id === companyId &&
      item.type === PROFILE_TYPE &&
      item.active === true
  );

  if (!prompt) {
    throw new Error("COMPANY_AGENT_NOT_CONFIGURED");
  }

  const metadata = prompt.metadata ?? {};

  const stringField = (name: string): string => {
    const value = metadata[name];

    return typeof value === "string"
      ? value.trim()
      : "";
  };

  const businessName = stringField("businessName");
  const businessDescription =
    stringField("businessDescription");

  if (!businessName || !businessDescription) {
    throw new Error("COMPANY_AGENT_PROFILE_INCOMPLETE");
  }

  return {
    companyId,
    businessName,
    businessDescription,
    instructions: prompt.prompt,
    verifiedContext: stringField("verifiedContext"),
  };
}

export async function previewConfiguredCompanyAgent(
  input: {
    companyId: string;
    message: string;
    history?: CompanyHistoryMessage[];
  }
) {
  const profile = await loadCompanyAgentProfile(
    input.companyId
  );

  return previewCompanyAgent({
    companyId: input.companyId,
    profile,
    message: input.message,
    history: input.history ?? [],
  });
}
