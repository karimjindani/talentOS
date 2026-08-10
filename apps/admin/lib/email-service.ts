/**
 * Admin-side email service for recruiter access approval notifications.
 * Mirrors the applicant email service but lives in the admin app.
 */

import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] as string);
}

function deliveryMode(): "smtp" | "log" {
  if (process.env.EMAIL_DELIVERY_MODE === "log") return "log";
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) return "smtp";
  if (process.env.NODE_ENV !== "production") return "log";
  throw new Error("Email delivery is not configured. Set SMTP variables or EMAIL_DELIVERY_MODE=log for local use.");
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

export interface VerificationEmailData {
  to: string;
  recruiterName: string;
  graduateName: string;
  verificationUrl: string;
  expiresAt: Date;
}

export async function sendVerificationEmail(data: VerificationEmailData) {
  if (deliveryMode() === "log") {
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

  return smtpTransporter().sendMail({
    from: process.env.EMAIL_FROM || "noreply@talentos.io",
    to: data.to,
    subject: "TalentOS Portfolio Access Approved",
    html,
    text
  });
}
