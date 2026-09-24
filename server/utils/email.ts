// Outgoing email: one transporter, HTML escaping for anything user-supplied,
// and the invitation email shared by every invite endpoint.
import nodemailer, { Transporter } from "nodemailer";
import logger from "./logger";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!process.env.GOOGLE_EMAIL_USER || !process.env.GOOGLE_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_EMAIL_USER,
        pass: process.env.GOOGLE_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

// RFC 2606 / 6761 reserved names never receive mail; skip them so tests and
// seed data don't bounce through the real mailbox.
const RESERVED_DOMAIN = /@((.+\.)?(example\.(com|net|org))|.+\.(test|invalid|localhost|example))$/i;

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  if (RESERVED_DOMAIN.test(opts.to)) {
    logger.info("email skipped (reserved domain)", { subject: opts.subject });
    return false;
  }
  const t = getTransporter();
  if (!t) {
    logger.warn("email not configured; skipping send", { subject: opts.subject });
    return false;
  }
  await t.sendMail({
    from: {
      name: "StockFlow",
      address: process.env.DONOTREPLY_EMAIL || process.env.GOOGLE_EMAIL_USER!,
    },
    ...opts,
  });
  return true;
}

/** Fire-and-forget: never throws, logs failures. */
export function sendEmailInBackground(opts: Parameters<typeof sendEmail>[0]): void {
  sendEmail(opts).catch((err) =>
    logger.error("email send failed", { subject: opts.subject, error: String(err) })
  );
}

export const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function invitationEmail(args: {
  toEmail: string;
  workspaceName: string;
  inviterName: string;
  invitationLink: string;
}) {
  const workspaceName = escapeHtml(args.workspaceName);
  const inviterName = escapeHtml(args.inviterName);
  const link = escapeHtml(args.invitationLink);
  const toEmail = escapeHtml(args.toEmail);
  const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Workspace Invitation</title></head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f5f5f5;">
    <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;">
      <table role="presentation" style="width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:8px;">
        <tr><td style="padding:40px 40px 20px 40px;text-align:center;background:#4f46e5;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:600;">You've been invited</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 20px 0;color:#333;font-size:16px;line-height:24px;">Hello,</p>
          <p style="margin:0 0 20px 0;color:#333;font-size:16px;line-height:24px;"><strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace.</p>
          <p style="margin:0 0 30px 0;color:#666;font-size:14px;line-height:22px;">This invitation expires in 7 days.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center">
            <a href="${link}" style="display:inline-block;padding:14px 40px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;">Accept invitation</a>
          </td></tr></table>
          <p style="margin:30px 0 0 0;color:#999;font-size:13px;line-height:20px;">If the button doesn't work, copy this link into your browser:<br><a href="${link}" style="color:#4f46e5;word-break:break-all;">${link}</a></p>
        </td></tr>
        <tr><td style="padding:30px 40px;background-color:#f8f9fa;border-radius:0 0 8px 8px;text-align:center;">
          <p style="margin:0 0 10px 0;color:#999;font-size:12px;">This invitation was sent to ${toEmail}.</p>
          <p style="margin:0;color:#999;font-size:12px;">If you didn't expect it, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`;
  const text = `${args.inviterName} has invited you to join ${args.workspaceName}.

Accept the invitation:
${args.invitationLink}

This invitation expires in 7 days. If you didn't expect it, you can ignore this email.`;
  return {
    to: args.toEmail,
    subject: `You've been invited to join ${args.workspaceName}`,
    html,
    text,
  };
}

export function welcomeEmail(args: { toEmail: string; firstName: string }) {
  const name = escapeHtml(args.firstName);
  return {
    to: args.toEmail,
    subject: "Welcome to StockFlow",
    text: `Hi ${args.firstName},\n\nYour StockFlow account is ready. Sign in at ${appUrl()}/login.\n\nIf you did not create this account, please ignore this email.`,
    html: `<html><body style="font-family:Arial,sans-serif;color:#333;background-color:#f9f9f9;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background-color:#fff;border:1px solid #ddd;border-radius:8px;padding:30px;text-align:center;">
    <h1 style="color:#4f46e5;margin-bottom:20px;">Welcome to StockFlow!</h1>
    <p style="font-size:16px;">Hi <strong>${name}</strong>,</p>
    <p style="font-size:16px;">Your account is ready. You can sign in any time at <a href="${escapeHtml(appUrl())}/login">${escapeHtml(appUrl())}</a>.</p>
    <p style="font-size:14px;color:#555;">If you did not create this account, please ignore this email.</p>
  </div>
</body></html>`,
  };
}

export function passwordResetEmail(args: { toEmail: string; resetUrl: string }) {
  const url = escapeHtml(args.resetUrl);
  return {
    to: args.toEmail,
    subject: "Password Change Request",
    text:
      `You are receiving this because you (or someone else) requested a password change for your StockFlow account.\n\n` +
      `Open the following link within one hour to choose a new password:\n\n${args.resetUrl}\n\n` +
      `If you did not request this, ignore this email and your password will remain unchanged.\n`,
    html: `<html><body style="font-family:Arial,sans-serif;color:#333;">
  <div style="max-width:600px;margin:20px auto;border:1px solid #ddd;padding:20px;text-align:center;">
    <h1 style="color:#4f46e5;">Password Change Request</h1>
    <p style="font-size:16px;">You are receiving this because you (or someone else) requested a password change for your account.</p>
    <p style="font-size:16px;">Open the link below within one hour to choose a new password:</p>
    <a href="${url}" style="display:inline-block;padding:10px 20px;margin:20px 0;background-color:#4f46e5;color:white;text-decoration:none;border-radius:5px;">Reset Password</a>
    <p style="font-size:14px;">If you did not request this, ignore this email and your password will remain unchanged.</p>
  </div>
</body></html>`,
  };
}
