type ReportProfile = {
  overview: { name: string; bio: string | null; country: string | null; skills: string[]; interests: string[]; program?: { name: string } | null };
  rating: number; completionDate: Date | string; artifacts: { title: string; url: string; description: string | null }[];
  aiEvaluation: null | { technicalSkills: number | null; problemSolving: number | null; communication: number | null; ownership: number | null; teamCollaboration: number | null; summary: string | null };
  assignments: { missionTitle: string; rating: number | null; reviewerFeedback: string | null; repositoryUrl: string | null; deploymentUrl: string | null }[];
};

function clean(value: unknown) { return String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim(); }
function wrap(text: string, width = 88) { const words = clean(text).split(" "); const lines: string[] = []; let line = ""; for (const word of words) { if (`${line} ${word}`.trim().length > width) { if (line) lines.push(line); line = word; } else line = `${line} ${word}`.trim(); } if (line) lines.push(line); return lines; }
function esc(text: string) { return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }

export function buildCandidateReport(profile: ReportProfile): Buffer {
  const lines: { text: string; size?: number; bold?: boolean; gap?: number }[] = [];
  const heading = (text: string) => lines.push({ text, size: 15, bold: true, gap: 8 });
  const paragraph = (text: string) => wrap(text).forEach((part) => lines.push({ text: part, size: 10 }));
  lines.push({ text: "TalentOS Candidate Report", size: 22, bold: true, gap: 8 }, { text: profile.overview.name, size: 18, bold: true }, { text: `${profile.overview.program?.name || "TalentOS program"} | Completed ${new Date(profile.completionDate).toLocaleDateString("en-US")} | Overall rating ${profile.rating.toFixed(2)}/5`, size: 10, gap: 10 });
  if (profile.overview.bio) paragraph(profile.overview.bio);
  if (profile.overview.skills.length) paragraph(`Skills: ${profile.overview.skills.join(", ")}`);
  if (profile.overview.interests.length) paragraph(`Interests: ${profile.overview.interests.join(", ")}`);
  heading("AI evaluation");
  if (profile.aiEvaluation) { paragraph(`Technical skills ${profile.aiEvaluation.technicalSkills}/5 | Problem solving ${profile.aiEvaluation.problemSolving}/5 | Communication ${profile.aiEvaluation.communication}/5 | Ownership ${profile.aiEvaluation.ownership}/5 | Teamwork ${profile.aiEvaluation.teamCollaboration}/5`); paragraph(profile.aiEvaluation.summary || "No summary available."); } else paragraph("AI evaluation is pending and is not included in this report.");
  heading("Verified mission results");
  for (const assignment of profile.assignments) { lines.push({ text: `${assignment.missionTitle} - ${assignment.rating?.toFixed(1) || "N/A"}/5`, size: 11, bold: true, gap: 2 }); if (assignment.reviewerFeedback) paragraph(`Reviewer: ${assignment.reviewerFeedback}`); if (assignment.repositoryUrl) paragraph(`Repository: ${assignment.repositoryUrl}`); if (assignment.deploymentUrl) paragraph(`Deployment: ${assignment.deploymentUrl}`); lines.push({ text: "", gap: 5 }); }
  if (profile.artifacts.length) { heading("Additional artifacts"); profile.artifacts.forEach((artifact) => paragraph(`${artifact.title}: ${artifact.url}${artifact.description ? ` - ${artifact.description}` : ""}`)); }

  const pages: typeof lines[] = [[]]; let y = 748;
  for (const line of lines) { const height = (line.size || 10) + (line.gap || 3); if (y - height < 55) { pages.push([]); y = 748; } pages.at(-1)!.push(line); y -= height; }
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  const pageIds: number[] = [];
  for (const page of pages) { const pageId = objects.length + 1, streamId = pageId + 1; pageIds.push(pageId); let cursor = 748; const commands = ["BT"];
    for (const line of page) { const size = line.size || 10; commands.push(`/${line.bold ? "F2" : "F1"} ${size} Tf`, `1 0 0 1 54 ${cursor} Tm`, `(${esc(line.text)}) Tj`); cursor -= size + (line.gap || 3); }
    commands.push("ET"); const stream = commands.join("\n"); objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n", offset = pdf.length; const offsets = [0]; objects.forEach((object, index) => { offsets.push(offset); const value = `${index + 1} 0 obj\n${object}\nendobj\n`; pdf += value; offset += Buffer.byteLength(value); });
  const xref = offset; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}
