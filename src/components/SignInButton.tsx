"use client";

import { useState } from "react";
import { EnAlert } from "@/components/EnParts";
import { EnSpinner } from "@/components/EnIcons";
import { authClient } from "@/lib/auth/client";

/** The only way in: Continue with Google. The same button creates the account the first time. */
export default function SignInButton({ next = "/home" }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}${next}` });
      if (res && "error" in res && res.error) {
        setError("Google sign-in could not start. Please check your internet and try again.");
        setBusy(false);
      }
    } catch {
      setError("Google sign-in could not start. Please check your internet and try again.");
      setBusy(false);
    }
  }

  // Look only (Phase G1): a 56px Google button that keeps its size while it works (spinner + label), and an error
  // banner above it with an icon and a calm second line. The button stays tappable for another try.
  return (
    <div className="en-sign">
      {error && (
        <EnAlert icon="wifioff" title="Google sign-in could not start">Please check your internet and try again.</EnAlert>
      )}
      <button type="button" className="btn google en-google" onClick={go} disabled={busy} aria-busy={busy}>
        {busy ? (
          <EnSpinner />
        ) : (
          <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
        )}
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && <p className="en-sign-hint">Still stuck? Check you are online, then tap the button again.</p>}
    </div>
  );
}
