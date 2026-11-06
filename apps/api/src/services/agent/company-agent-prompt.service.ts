import {
  loadCompanyAgentProfile,
} from "./company-agent-profile.repository.js";

import {
  buildCompanyBusinessPrompt,
} from "../../prompts/company-agent.prompt.js";

export type CompanyAgentPromptRequest = {
  companyId: string;
  customerMessage: string;
  conversationHistory?: string;
  memoryContext?: string;
  knowledgeContext?: string;
};

export async function buildConfiguredCompanyPrompt(
  input: CompanyAgentPromptRequest
): Promise<string> {
  if (!input.companyId?.trim()) {
    throw new Error("COMPANY_ID_REQUIRED");
  }

  const profile = await loadCompanyAgentProfile(
    input.companyId
  );

  if (profile.companyId !== input.companyId) {
    throw new Error("COMPANY_PROFILE_MISMATCH");
  }

  return buildCompanyBusinessPrompt({
    businessName: profile.businessName,
    businessDescription: profile.businessDescription,
    instructions: profile.instructions,
    verifiedContext: profile.verifiedContext,
    customerMessage: input.customerMessage,
    conversationHistory:
      input.conversationHistory ?? "",
    memoryContext:
      input.memoryContext ?? "",
    knowledgeContext:
      input.knowledgeContext ?? "",
  });
}
