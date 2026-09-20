// Nodemailer wrapper for sending OTP emails via Gmail SMTP.
//
// Set the following in .env.local:
//
//   GMAIL_USER=heawen.ias14319@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char Google App Password)
//   MAIL_FROM_NAME="HAI SUPER HERO"
//
// How to get a Gmail App Password:
//   1. Enable 2-Step Verification on the Google account.
//   2. Go to https://myaccount.google.com/apppasswords
//   3. Create an App Password named "HAI SUPER HERO dev".
//   4. Copy the 16-char password (with spaces) into GMAIL_APP_PASSWORD.

import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? "";
const FROM_NAME = process.env.MAIL_FROM_NAME ?? "HAI SUPER HERO";

let _cachedTransport: nodemailer.Transporter | null = null;

function transport(): nodemailer.Transporter {
  if (_cachedTransport) return _cachedTransport;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      "Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local.",
    );
  }
  _cachedTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD, // 16-char App Password (spaces OK)
    },
    // Tolerate corporate / antivirus TLS interception.
    tls: { rejectUnauthorized: false },
  });
  return _cachedTransport;
}

export function isEmailConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function htmlFor(purpose: "register" | "login", otp: string): string {
  const heading =
    purpose === "register"
      ? "Welcome to HAI SUPER HERO"
      : "HAI SUPER HERO — sign-in code";
  const subheading =
    purpose === "register"
      ? "Use the 6-digit code below to verify your email and finish creating your account."
      : "Use the 6-digit code below to sign in to your HAI SUPER HERO account.";
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1a25;padding:32px 16px;color:#e5edf5;">
    <div style="max-width:480px;margin:0 auto;background:#14202b;border:1px solid #1f2c39;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#ffffff;font-weight:600;">${heading}</h1>
      <p style="margin:0 0 24px;color:#8b95a1;font-size:14px;">${subheading}</p>
      <div style="background:#0f1a25;border:1px solid #00bcd4;border-radius:10px;padding:18px;text-align:center;">
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#00bcd4;">${otp}</div>
        <div style="margin-top:6px;font-size:12px;color:#8b95a1;">Valid for 10 minutes</div>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#8b95a1;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}

function textFor(purpose: "register" | "login", otp: string): string {
  return [
    purpose === "register"
      ? "Welcome to HAI SUPER HERO!"
      : "HAI SUPER HERO — sign-in code",
    "",
    `Your 6-digit code is: ${otp}`,
    "",
    "This code is valid for 10 minutes.",
    "If you didn't request this code, you can safely ignore this email.",
  ].join("\n");
}

/**
 * Send the OTP to the given email address.
 *
 * Returns `true` if Gmail accepted the message (it'll arrive in a few
 * seconds), `false` if sending failed (e.g. wrong App Password, no
 * network, daily quota exceeded). The caller should log the error
 * but NOT fail the request just because email failed — the OTP is
 * also stored in the DB, so a user who didn't get the email can ask
 * for a resend.
 */
export async function sendOtpEmail(
  to: string,
  otp: string,
  purpose: "register" | "login",
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.error(
      "[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping send.",
    );
    return false;
  }
  try {
    const subject =
      purpose === "register"
        ? "Your HAI SUPER HERO verification code"
        : "Your HAI SUPER HERO sign-in code";
    const info = await transport().sendMail({
      from: `"${FROM_NAME}" <${GMAIL_USER}>`,
      to,
      subject,
      text: textFor(purpose, otp),
      html: htmlFor(purpose, otp),
    });
    console.log(
      `[email] OTP sent to ${to} (purpose=${purpose}, messageId=${info.messageId})`,
    );
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[email] sendOtpEmail failed for ${to}: ${msg}`);
    return false;
  }
}