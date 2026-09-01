import Link from "next/link";
import { CONTACT } from "@/content";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh overflow-y-auto mx-auto max-w-2xl px-4 py-10 text-white/85">
      <Link href="/" className="text-sm text-cyan-400 hover:underline">← Back home</Link>
      <h1 className="mt-3 text-2xl font-bold tracking-[0.18em] text-cyan-400">PRIVACY POLICY</h1>
      <p className="mt-3 leading-relaxed text-white/75">
        HAI SUPER HERO uses a single small cookie to remember your chat session across
        visits. We do not track you across other sites and we do not sell your
        data. Chat messages are stored against a randomly generated visitor
        identifier (a UUID) and are visible only to you and our staff. You can
        decline cookies and the site will still function, but your chat history
        will not persist across visits.
      </p>
      <p className="mt-3 leading-relaxed text-white/75">
        For any privacy requests, email us at{" "}
        <a className="text-cyan-400 underline" href={`mailto:${CONTACT.email}`}>
          {CONTACT.email}
        </a>.
      </p>
    </main>
  );
}
