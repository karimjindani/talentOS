export type AIInteractionRequest = {
  tenantId: string;
  userId?: string;
  purpose: "mentor" | "knowledge_assistant" | "reviewer" | "interviewer";
  prompt: string;
};

export type AIInteractionResponse = {
  status: "stubbed";
  message: string;
};

export async function requestAIInteraction(
  request: AIInteractionRequest
): Promise<AIInteractionResponse> {
  void request;
  return {
    status: "stubbed",
    message: "AI mentor boundary is defined; workflow implementation is deferred after the applications slice."
  };
}
