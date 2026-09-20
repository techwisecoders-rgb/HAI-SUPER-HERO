// Standalone nodemailer test. Verifies that GMAIL_USER + GMAIL_APP_PASSWORD
// in .env.local can actually deliver a real email.
//
// Usage: node scripts/test-email.mjs [recipient@example.com]
// Defaults recipient to the GMAIL_USER itself.

import nodemailer from "nodemailer";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  // tiny inline .env loader — strip optional surrounding quotes
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} else {
  console.error(`No .env.local found at ${envPath}`);
  process.exit(1);
}

const USER = process.env.GMAIL_USER;
const PASS = process.env.GMAIL_APP_PASSWORD;
const FROM_NAME = process.env.MAIL_FROM_NAME || "HAI SUPER HERO";
const to = process.argv[2] || USER;

if (!USER || !PASS) {
  console.error("GMAIL_USER / GMAIL_APP_PASSWORD missing in .env.local");
  process.exit(1);
}

console.log(`Sending test email from "${USER}" to "${to}" ...`);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: USER, pass: PASS },
  // Some corporate networks / antivirus products MITM TLS with their
  // own root CA. nodemailer strict-verifies by default and fails with
  // "self-signed certificate in certificate chain". Loosening the
  // verification here is acceptable for a dev/test SMTP send.
  tls: { rejectUnauthorized: false },
});

const otp = Math.floor(100000 + Math.random() * 900000).toString();

try {
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${USER}>`,
    to,
    subject: `[HAI SUPER HERO] nodemailer test — your code is ${otp}`,
    text: `This is a nodemailer smoke test from HAI SUPER HERO.\n\nYour test OTP is ${otp}.\n\nIf you got this email, OTP email delivery is working.`,
    html: `<div style="font-family:sans-serif;padding:24px;background:#0f1a25;color:#e5edf5;">
      <h2 style="color:#fff;">HAI SUPER HERO — nodemailer test</h2>
      <p>This is a smoke test. Your code is:</p>
      <div style="font-size:32px;letter-spacing:8px;color:#00bcd4;font-weight:bold;">${otp}</div>
      <p>If you got this email, OTP delivery works.</p>
    </div>`,
  });
  console.log("OK messageId:", info.messageId);
  console.log("Accepted:", info.accepted);
  console.log("Rejected:", info.rejected);
  console.log("Response:", info.response);
  console.log(`\nTest OTP (for your reference): ${otp}`);
} catch (e) {
  console.error("FAIL:", e.message);
  if (e.code) console.error("code:", e.code);
  if (e.responseCode) console.error("responseCode:", e.responseCode);
  process.exit(1);
}