"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function LoginForm({ initialError = "" }: { initialError?: string }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  async function sendMagicLink(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithGoogle(): Promise<void> {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="authcard">
      <h1 className="authtitle">Sign in to ProxiPixel</h1>
      <p className="authsub">
        Processing is always local and free. Sign in only to save job history,
        presets, and outputs.
      </p>

      {!isSupabaseConfigured && (
        <p className="authnote">
          Supabase isn’t configured yet — set NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to enable sign-in.
        </p>
      )}

      {sent ? (
        <p className="authok">
          Check your inbox — we sent a magic link to <b>{email}</b>.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="authform">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="run" type="submit" disabled={loading || !email}>
            {loading ? "Sending…" : "Email me a magic link"}
          </button>
        </form>
      )}

      <div className="authdiv">or</div>

      <button className="ghost authgoogle" onClick={() => void signInWithGoogle()}>
        Continue with Google
      </button>

      {error && <p className="autherr">{error}</p>}
    </div>
  );
}
