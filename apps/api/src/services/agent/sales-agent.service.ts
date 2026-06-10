import { buildSalesAgentPrompt } from "../../prompts/sales-agent.prompt.js";
import { getPrompt } from "../prompts/prompt.repository.js";
import { generateAgentResponse } from "../anthropic/anthropic.service.js";
import { buildCustomerMemoryContext } from "../memory/customer-memory.repository.js";
import { buildKnowledgeContext } from "../knowledge/knowledge.repository.js";
import { buildCatalogContext } from "../catalog/catalog.repository.js";

export async function salesAgentReply(input: {
  phone: string;
  message: string;
}) {
  const [salesPrompt, memoryContext, knowledgeContext, catalogContext] = await Promise.all([
    getPrompt("sales"),
    buildCustomerMemoryContext(input.phone),
    buildKnowledgeContext(input.message),
    buildCatalogContext(input.message)
  ]);

  const prompt = buildSalesAgentPrompt({
    customerMessage: input.message,
    customerPhone: input.phone,
    basePrompt: salesPrompt.prompt,
    memoryContext,
    knowledgeContext,
    catalogContext
  });

  const response = await generateAgentResponse(prompt);

  console.log("[CLAUDE RESPONSE]", response);

  return response;
}
