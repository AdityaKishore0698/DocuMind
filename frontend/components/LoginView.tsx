"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

type Mode = "signin" | "register" | "otp" | "reset";

export default function LoginView() {
  const {
    signInWithPassword,
    signUpWithPassword,
    verifySignupOtp,
    resendSignupCode,
    signInWithGoogle,
    sendPasswordReset,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setCode("");
  }

  async function run(fn: () => Promise<void>) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signin") {
      await run(() => signInWithPassword(email.trim(), password));
    } else if (mode === "register") {
      await run(async () => {
        await signUpWithPassword(email.trim(), password);
        setNotice(`We sent a 6-digit code to ${email.trim()}.`);
        setMode("otp");
      });
    } else if (mode === "otp") {
      await run(() => verifySignupOtp(email.trim(), code.trim()));
    } else {
      await run(async () => {
        await sendPasswordReset(email.trim());
        setNotice("Check your email for a reset link.");
      });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">DocuMind</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chat with your documents.</p>
        </div>

        {mode !== "otp" && mode !== "reset" && (
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1 text-sm">
            {(["signin", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => reset(m)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  mode === m
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {mode !== "otp" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          )}

          {(mode === "signin" || mode === "register") && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          )}

          {mode === "otp" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">
                6-digit code sent to {email}
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.4em] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          )}

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
          )}
          {notice && (
            <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">{notice}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : mode === "otp"
                    ? "Verify & continue"
                    : "Send reset link"}
          </button>
        </form>

        {mode === "otp" && (
          <button
            type="button"
            onClick={() => run(() => resendSignupCode(email.trim()))}
            disabled={busy}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Resend code
          </button>
        )}

        {(mode === "signin" || mode === "register") && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={() => run(signInWithGoogle)}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-50"
            >
              <GoogleMark /> Continue with Google
            </button>
          </>
        )}

        <div className="mt-5 text-center text-xs text-muted-foreground">
          {mode === "signin" && (
            <button type="button" onClick={() => reset("reset")} className="hover:text-foreground">
              Forgot your password?
            </button>
          )}
          {(mode === "otp" || mode === "reset") && (
            <button type="button" onClick={() => reset("signin")} className="hover:text-foreground">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.3 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.9-9.7 6.9-17.4z" />
      <path fill="#FBBC05" d="M10.5 28.3a14.6 14.6 0 0 1 0-8.6l-7.9-6.1a24 24 0 0 0 0 20.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-3.8-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
