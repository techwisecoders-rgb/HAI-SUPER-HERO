// Format a worker_registrations row as a chat-friendly message that
// we can append to the visitor's session. Used by /api/worker/register
// and /api/worker/verify-otp so the user + the admin can both see the
// submitted details in the chat thread.
//
// Two flavours:
//   * "submission" — written by the visitor at submit time (sender_type
//     'user', because the visitor is effectively sharing the form data
//     with the admin). Includes a small "Awaiting email verification"
//     note when email was supplied.
//   * "confirmed" — written by the bot at OTP-verify time (sender_type
//     'auto') acknowledging that the registration was confirmed.
//
// Returned text is plain text with simple newlines; the chat UI already
// preserves newlines in `white-space: pre-wrap`.

interface WorkerRegistrationLike {
  full_name: string;
  phone: string;
  email: string | null;
  address: string;
  work_type: string;
  work_description: string;
  qualification: string | null;
  years_experience: string | null;
  availability: string | null;
}

function fmt(label: string, value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "";
  return `${label}: ${value}`;
}

/**
 * The message a visitor effectively sends to the admin when they
 * submit the worker registration form. Goes into the chat as a
 * `user`-typed message (the same sender as their normal chat input),
 * so it shows up in both the visitor's view and the admin's
 * session view.
 */
export function formatWorkerRegistrationMessage(
  reg: WorkerRegistrationLike,
): string {
  const lines: string[] = [];
  lines.push("📋 New worker registration submitted");
  lines.push("");
  lines.push(fmt("Name", reg.full_name));
  lines.push(fmt("Phone", reg.phone));
  lines.push(fmt("Email", reg.email));
  lines.push(fmt("Address", reg.address));
  lines.push(fmt("Work type", reg.work_type));
  lines.push(fmt("Description", reg.work_description));
  const q = fmt("Qualification", reg.qualification);
  if (q) lines.push(q);
  const y = fmt("Years of experience", reg.years_experience);
  if (y) lines.push(y);
  const a = fmt("Availability", reg.availability);
  if (a) lines.push(a);
  if (reg.email) {
    lines.push("");
    lines.push("Awaiting email verification (OTP sent).");
  } else {
    lines.push("");
    lines.push("Saved without email verification.");
  }
  return lines.join("\n");
}

/**
 * Confirmation message written by the bot once the visitor enters
 * the OTP. Goes in as `auto` so it doesn't pretend to be a real
 * human admin reply.
 */
export function formatWorkerRegistrationConfirmedMessage(
  reg: WorkerRegistrationLike,
): string {
  const lines: string[] = [];
  lines.push("✅ Worker registration confirmed");
  lines.push("");
  lines.push(fmt("Name", reg.full_name));
  lines.push(fmt("Phone", reg.phone));
  if (reg.email) lines.push(fmt("Email", reg.email));
  lines.push(fmt("Work type", reg.work_type));
  lines.push("");
  lines.push(
    "Thanks for registering! Our team will review your details and reach out shortly.",
  );
  return lines.join("\n");
}
