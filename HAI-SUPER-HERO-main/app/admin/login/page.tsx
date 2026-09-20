"use client";

// Next 14 requires pages that use `useSearchParams()` to be wrapped in
// a <Suspense> boundary during static prerender. The wrapper below
// satisfies that, then renders the form on the client.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center px-4" />}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-2/90 p-6 shadow-2xl backdrop-blur"
      >
        <h1 className="font-display text-xl tracking-[0.2em] text-gold">ADMIN LOGIN</h1>
        <p className="mt-1 text-xs text-white/60">
          Sign in with your provisioned admin email and password.
        </p>

        <label className="mt-4 block text-sm">
          <span className="text-white/70">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-violet"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-white/70">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-violet"
          />
        </label>

        {err && <p className="mt-3 text-sm text-rose">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-violet to-rose py-2 font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
