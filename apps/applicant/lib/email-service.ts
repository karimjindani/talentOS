import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let resendClient: import("resend").Resend | null = null;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => (({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] as string));
}

function emailProvider(): "resend" | "smtp" | "log" {
  if (process.env.EMAIL_DELIVERY_MODE === "log") return "log";
  if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY) return "resend";
  if (process.env.EMAIL_PROVIDER === "resend" && !process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") return "log";
    throw new Error("EMAIL_PROVIDER is 'resend' but RESEND_API_KEY is not set.");
  }
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) return "smtp";
  if (process.env.NODE_ENV !== "production") return "log";
  throw new Error("Email delivery is not configured. Set RESEND_API_KEY or SMTP variables, or EMAIL_DELIVERY_MODE=log for local use.");
}

function smtpTransporter() {
  transporter ??= nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
  });
  return transporter;
}

async function getResendClient() {
  if (!resendClient) {
    const { Resend } = await import("resend");
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export interface VerificationEmailData {
  to: string;
  recruiterName: string;
  graduateName: string;
  verificationUrl: string;
  expiresAt: Date;
}

export async function sendVerificationEmail(data: VerificationEmailData) {
  const provider = emailProvider();

  if (provider === "log") {
    console.info(`[email preview] Recruiter verification for ${data.to}: ${data.verificationUrl}`);
    return { messageId: "local-email-preview" };
  }

  const recruiterName = escapeHtml(data.recruiterName);
  const graduateName = escapeHtml(data.graduateName);
  const verificationUrl = escapeHtml(data.verificationUrl);
  const expiryDate = data.expiresAt.toLocaleDateString();
  const html = `
    <!doctype html><html><body style="font-family:Segoe UI,Tahoma,sans-serif;color:#334155">
      <main style="max-width:600px;margin:auto;padding:24px">
        <h1 style="color:#1e3a8a">Verify your TalentOS portfolio access</h1>
        <p>Hi ${recruiterName},</p>
        <p>You requested access to <strong>${graduateName}</strong>&#39;s verified graduate portfolio.</p>
        <p><a href="${verificationUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Verify and view portfolio</a></p>
        <p>This link expires on <strong>${expiryDate}</strong>. If you did not request it, ignore this email.</p>
      </main>
    </body></html>`;
  const text = `Hi ${data.recruiterName},\n\nVerify access to ${data.graduateName}'s TalentOS portfolio:\n${data.verificationUrl}\n\nThis link expires on ${expiryDate}.`;
  const from = process.env.EMAIL_FROM || "noreply@talentos.io";
  const subject = "Access to TalentOS Graduate Profile";

  if (provider === "resend") {
    const { data: resendData, error } = await (await getResendClient()).emails.send({ from, to: data.to, subject, html, text });
    if (error) throw new Error(`Resend API error: ${error.message}`);
    return { messageId: resendData?.id ?? "resend-sent" };
  }

  return smtpTransporter().sendMail({ from, to: data.to, subject, html, text });
}

export async function sendProfileViewNotification(data: {
  to: string;
  graduateName: string;
  recruiterName: string;
  recruiterOrganization?: string;
  viewedAt: Date;
}) {
  try {
    const provider = emailProvider();
    if (provider === "log") {
      console.info(`[email preview] Profile-view notification for ${data.to}`);
      return;
    }
    const dashboardUrl = new URL("/dashboard", process.env.PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3100").toString();
    const organization = data.recruiterOrganization
      ? ` from <strong>${escapeHtml(data.recruiterOrganization)}</strong>`
      : "";
    const from = process.env.EMAIL_FROM || "noreply@talentos.io";
    const html = `<p>Hi ${escapeHtml(data.graduateName)},</p><p><strong>${escapeHtml(data.recruiterName)}</strong>${organization} viewed your graduate profile at ${escapeHtml(data.viewedAt.toLocaleString())}.</p><p><a href="${escapeHtml(dashboardUrl)}">Open TalentOS</a></p>`;
    const text = `Hi ${data.graduateName},\n\n${data.recruiterName}${data.recruiterOrganization ? ` from ${data.recruiterOrganization}` : ""} viewed your graduate profile at ${data.viewedAt.toLocaleString()}.\n\nOpen TalentOS: ${dashboardUrl}`;
    const subject = "Your TalentOS Profile Was Viewed";

    if (provider === "resend") {
      const { error } = await (await getResendClient()).emails.send({ from, to: data.to, subject, html, text });
      if (error) throw new Error(`Resend API error: ${error.message}`);
      return;
    }
    await smtpTransporter().sendMail({ from, to: data.to, subject, html, text });
  } catch (error) {
    console.error("Error sending profile view notification:", error);
  }
}

export async function sendCandidateContactEmail(data: { to: string; graduateName: string; recruiterName: string; recruiterEmail: string; organization?: string; message: string }) {
  const provider = emailProvider();
  if (provider === "log") {
    console.info(`[email preview] Candidate contact from ${data.recruiterEmail} to ${data.to}: ${data.message}`);
    return { messageId: "local-email-preview" };
  }
  const from = process.env.EMAIL_FROM || "noreply@talentos.io";
  const subject = `${data.recruiterName} would like to connect through TalentOS`;
  const text = `Hi ${data.graduateName},\n\n${data.recruiterName}${data.organization ? ` from ${data.organization}` : ""} sent you this message:\n\n${data.message}\n\nReply directly to this email to contact ${data.recruiterEmail}.`;
  const html = `<p>Hi ${escapeHtml(data.graduateName)},</p><p><strong>${escapeHtml(data.recruiterName)}</strong>${data.organization ? ` from <strong>${escapeHtml(data.organization)}</strong>` : ""} sent you this message:</p><blockquote>${escapeHtml(data.message).replace(/\n/g, "<br>")}</blockquote><p>Reply to this email to contact the recruiter.</p>`;

  if (provider === "resend") {
    const { data: resendData, error } = await (await getResendClient()).emails.send({ from, to: data.to, subject, html, text, replyTo: data.recruiterEmail });
    if (error) throw new Error(`Resend API error: ${error.message}`);
    return { messageId: resendData?.id ?? "resend-sent" };
  }

  return smtpTransporter().sendMail({ from, replyTo: data.recruiterEmail, to: data.to, subject, text, html });
}
