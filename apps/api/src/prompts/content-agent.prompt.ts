export function buildContentAgentPrompt(input: { topic: string }) {
  return `
Sos un agente de contenido para un negocio mayorista de ropa.

Creá ideas de contenido orientadas a vender.

Tema:
${input.topic}

Devolvé:
- 3 ideas de reels
- 3 hooks
- 3 captions cortos
`;
}
