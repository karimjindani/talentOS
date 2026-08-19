import { mkdir, writeFile } from "node:fs/promises";
import { buildCandidateReport } from "../apps/applicant/lib/candidate-report";

async function main() {
const output = "tmp/pdfs/talentos-candidate-report-sample.pdf";
await mkdir("tmp/pdfs", { recursive: true });
await writeFile(output, buildCandidateReport({
  overview: { name: "Amina Rahman", bio: "Full-stack engineer focused on reliable, accessible products and evidence-driven delivery.", country: "Pakistan", skills: ["TypeScript", "React", "Node.js", "PostgreSQL"], interests: ["Accessibility", "AI tooling"], program: { name: "AI-Native Software Engineering" } },
  rating: 4.63, completionDate: "2026-06-20T00:00:00.000Z",
  aiEvaluation: { technicalSkills: 4.7, problemSolving: 4.6, communication: 4.4, ownership: 4.5, teamCollaboration: 4.3, summary: "Evidence shows strong implementation quality, systematic debugging, and clear written reflection. Scores should be interpreted alongside the verified mission evidence below." },
  artifacts: [{ title: "Architecture case study", url: "https://example.com/case-study", description: "Trade-off analysis and production diagram." }],
  assignments: Array.from({ length: 7 }, (_, index) => ({ missionTitle: `Mission ${index + 1}: Production feature delivery`, rating: 4.2 + (index % 4) * 0.2, reviewerFeedback: "Delivered a well-tested implementation, documented key decisions, and responded constructively to review feedback.", repositoryUrl: "https://github.com/example/project", deploymentUrl: "https://example.com/demo" }))
}));
console.log(output);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
