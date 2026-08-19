import { getGraduateEvaluationEvidence, saveGraduateAiEvaluation } from "@talentos/db";

type Evaluation = { technicalSkills: number; problemSolving: number; communication: number; ownership: number; teamCollaboration: number; summary: string };

export async function evaluateGraduateProfile(graduateId: string) {
  const apiKey = process.env.GLM_Z_API_KEY || process.env.ZHIPUAI_API_KEY;
  if (!apiKey) return { status: "not-configured" as const };
  const evidence = await getGraduateEvaluationEvidence(graduateId);
  if (!evidence) return { status: "missing" as const };
  const response = await fetch(`${process.env.ZHIPUAI_BASE_URL || "https://api.z.ai/api/coding/paas/v4"}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: process.env.ZHIPUAI_MODEL || "glm-4.5-air", temperature: 0.2, max_tokens: 700, messages: [
      { role: "system", content: "You are a fair recruiting evaluator. Use only supplied evidence. Return strict JSON with numeric 1-5 keys technicalSkills, problemSolving, communication, ownership, teamCollaboration and a concise summary. Do not infer protected traits." },
      { role: "user", content: JSON.stringify(evidence) }
    ] }), signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`AI evaluation provider returned ${response.status}.`);
  const result = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = result.choices?.[0]?.message?.content || "";
  const match = content.match(/\{[\s\S]*\}/); if (!match) throw new Error("AI evaluation did not return JSON.");
  const parsed = JSON.parse(match[0]) as Evaluation;
  const keys: (keyof Omit<Evaluation, "summary">)[] = ["technicalSkills", "problemSolving", "communication", "ownership", "teamCollaboration"];
  for (const key of keys) if (!Number.isFinite(parsed[key]) || parsed[key] < 1 || parsed[key] > 5) throw new Error(`Invalid AI score: ${key}.`);
  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) throw new Error("AI summary is missing.");
  await saveGraduateAiEvaluation(graduateId, { ...parsed, summary: parsed.summary.trim().slice(0, 1200) });
  return { status: "completed" as const };
}
