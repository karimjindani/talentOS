/**
 * Admin-side email service for recruiter access approval notifications.
 * Supports both Resend API and SMTP (nodemailer) as transport providers.
 * Provider is selected via EMAIL_PROVIDER env var: "resend" or "smtp" (default).
 * Mirrors the applicant email service but lives in the admin app.
 */

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
        <h1 style="color:#1e3a8a">Your TalentOS portfolio access is approved</h1>
        <p>Hi ${recruiterName},</p>
        <p>Your request to access <strong>${graduateName}</strong>&#39;s verified graduate portfolio has been approved.</p>
        <p><a href="${verificationUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Verify and view portfolio</a></p>
        <p>This link expires on <strong>${expiryDate}</strong>. If you did not request it, ignore this email.</p>
      </main>
    </body></html>`;
  const text = `Hi ${data.recruiterName},\n\nYour access to ${data.graduateName}'s TalentOS portfolio has been approved.\nVerify here: ${data.verificationUrl}\n\nThis link expires on ${expiryDate}.`;
  const from = process.env.EMAIL_FROM || "noreply@talentos.io";
  const subject = "Your TalentOS Recruiter Access Has Been Approved";

  if (provider === "resend") {
    const { data: resendData, error } = await (await getResendClient()).emails.send({
      from,
      to: data.to,
      subject,
      html,
      text,
    });
    if (error) throw new Error(`Resend API error: ${error.message}`);
    return { messageId: resendData?.id ?? "resend-sent" };
  }

  return smtpTransporter().sendMail({ from, to: data.to, subject, html, text });
}
