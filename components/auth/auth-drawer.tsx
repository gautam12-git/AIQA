"use client";

import { useCallback, useEffect, useState } from "react";
import {
  login, signup, verifyOtp, forgotPassword, verifyResetOtp, resetPassword,
} from "@/lib/data-api";
import { LogoMark } from "@/components/layout/logo";

/** Open the auth drawer from anywhere (landing CTAs dispatch this). */
export function openAuth(mode: "login" | "signup" | "forgot" = "login") {
  window.dispatchEvent(new CustomEvent("aiqa:open-auth", { detail: { mode } }));
}

type View =
  | "login" | "signup" | "verify"
  | "forgot" | "reset-otp" | "reset-new" | "reset-done";

const input =
  "w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none transition-colors";
const primaryBtn =
  "w-full rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryStyle = {
  background: "linear-gradient(120deg,var(--grad-start),var(--grad-mid) 55%,var(--grad-end))",
};

export function AuthDrawer({
  autoOpen = false,
  initialMode = "login",
}: {
  autoOpen?: boolean;
  initialMode?: "login" | "signup" | "forgot";
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clearMsgs = () => { setError(null); setNotice(null); setBusy(false); };
  const close = useCallback(() => setOpen(false), []);
  const go = (v: View) => { clearMsgs(); setView(v); };

  const viewFor = (m: string): View => (m === "signup" ? "signup" : m === "forgot" ? "forgot" : "login");

  useEffect(() => {
    function onOpen(e: Event) {
      const mode = (e as CustomEvent).detail?.mode || "login";
      clearMsgs();
      setView(viewFor(mode));
      setOpen(true);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("aiqa:open-auth", onOpen);
    window.addEventListener("keydown", onKey);
    if (autoOpen) { setView(viewFor(initialMode)); setOpen(true); }
    return () => {
      window.removeEventListener("aiqa:open-auth", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [autoOpen, initialMode]);

  // Lock body scroll while open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ---- handlers ----
  async function doLogin(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await login(email.trim(), password);
    if (r.ok) window.location.href = "/dashboard";
    else { setError(r.error); setBusy(false); }
  }
  async function doSignup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await signup(name.trim(), email.trim(), password);
    setBusy(false);
    if (r.ok) { setNotice(r.message ?? "Code sent to your email."); go("verify"); setNotice(r.message ?? "Code sent."); }
    else setError(r.error);
  }
  async function doVerify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await verifyOtp(email.trim(), otp.trim());
    if (r.ok) window.location.href = "/dashboard";
    else { setError(r.error); setBusy(false); }
  }
  async function resend() {
    setError(null); setNotice(null);
    const r = await signup(name.trim(), email.trim(), password);
    if (r.ok) setNotice("A new code has been sent."); else setError(r.error);
  }
  async function doForgotSend(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await forgotPassword(email.trim());
    setBusy(false);
    if (r.ok) { setNotice(r.message ?? "Code sent."); go("reset-otp"); setNotice(r.message ?? "Code sent."); }
    else setError(r.error);
  }
  async function doResetOtp(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await verifyResetOtp(email.trim(), otp.trim());
    setBusy(false);
    if (r.ok) go("reset-new"); else setError(r.error);
  }
  async function doReset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await resetPassword(email.trim(), otp.trim(), newPassword);
    setBusy(false);
    if (r.ok) go("reset-done"); else setError(r.error);
  }

  const title =
    view === "signup" ? "Create your account"
    : view === "verify" ? "Verify your email"
    : view === "forgot" ? "Reset your password"
    : view === "reset-otp" ? "Enter your code"
    : view === "reset-new" ? "Set a new password"
    : view === "reset-done" ? "Password updated"
    : "Welcome back";

  const subtitle =
    view === "signup" ? "Start finding real bugs with AIQA."
    : view === "verify" ? `Enter the 6-digit code sent to ${email}.`
    : view === "forgot" ? "We'll email you a verification code."
    : view === "reset-otp" ? `Enter the code sent to ${email}.`
    : view === "reset-new" ? "Choose a new password."
    : view === "reset-done" ? "You can now sign in with your new password."
    : "Sign in to your AIQA account.";

  return (
    <div aria-hidden={!open}>
      {/* Backdrop */}
      <div
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      {/* Sliding panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-[var(--shadow-pop)] transition-transform duration-[350ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8 rounded-lg" />
            <span className="font-semibold tracking-tight text-content">AIQA</span>
          </div>
          <button onClick={close} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-content">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-7">
          {/* Segmented toggle (login/signup) */}
          {(view === "login" || view === "signup") && (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1">
              <button onClick={() => go("login")} className={`rounded-lg py-2 text-sm font-medium transition-colors ${view === "login" ? "text-white" : "text-secondary hover:text-content"}`} style={view === "login" ? primaryStyle : undefined}>Sign in</button>
              <button onClick={() => go("signup")} className={`rounded-lg py-2 text-sm font-medium transition-colors ${view === "signup" ? "text-white" : "text-secondary hover:text-content"}`} style={view === "signup" ? primaryStyle : undefined}>Create account</button>
            </div>
          )}

          <h2 className="text-xl font-semibold text-content">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>

          <div className="mt-6" key={view}>
            <div className="aiqa-fade-up space-y-3">
              {view === "login" && (
                <form onSubmit={doLogin} className="space-y-3">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-label="Email" required className={input} />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" aria-label="Password" required className={input} />
                  <div className="flex justify-end">
                    <button type="button" onClick={() => go("forgot")} className="text-xs text-accent hover:text-accent-hover">Forgot password?</button>
                  </div>
                  {error && <p className="text-xs text-p0">{error}</p>}
                  <button type="submit" disabled={busy} className={primaryBtn} style={primaryStyle}>{busy ? "Signing in…" : "Sign in"}</button>
                </form>
              )}

              {view === "signup" && (
                <form onSubmit={doSignup} className="space-y-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" aria-label="Name" required className={input} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-label="Email" required className={input} />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" autoComplete="new-password" aria-label="Password" minLength={6} required className={input} />
                  {error && <p className="text-xs text-p0">{error}</p>}
                  <button type="submit" disabled={busy} className={primaryBtn} style={primaryStyle}>{busy ? "Sending code…" : "Create account"}</button>
                </form>
              )}

              {view === "verify" && (
                <form onSubmit={doVerify} className="space-y-3">
                  <input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" aria-label="Verification code" className={`${input} text-center text-lg tracking-[0.5em]`} required />
                  {notice && <p className="text-xs text-success">{notice}</p>}
                  {error && <p className="text-xs text-p0">{error}</p>}
                  <button type="submit" disabled={busy || otp.length !== 6} className={primaryBtn} style={primaryStyle}>{busy ? "Verifying…" : "Verify & continue"}</button>
                  <div className="flex justify-between text-xs text-muted">
                    <button type="button" onClick={() => go("signup")} className="hover:text-secondary">← Back</button>
                    <button type="button" onClick={resend} className="text-accent hover:text-accent-hover">Resend code</button>
                  </div>
                </form>
              )}

              {view === "forgot" && (
                <form onSubmit={doForgotSend} className="space-y-3">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-label="Email" required className={input} />
                  {error && <p className="text-xs text-p0">{error}</p>}
                  <button type="submit" disabled={busy} className={primaryBtn} style={primaryStyle}>{busy ? "Sending…" : "Send code"}</button>
                  <button type="button" onClick={() => go("login")} className="w-full text-center text-xs text-muted hover:text-secondary">Back to sign in</button>
                </form>
              )}

              {view === "reset-otp" && (
                <form onSubmit={doResetOtp} className="space-y-3">
                  <input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" aria-label="Reset code" className={`${input} text-center text-lg tracking-[0.5em]`} required />
                  {notice && <p className="text-xs text-success">{notice}</p>}
                  {error && <p className="text-xs text-p0">{error}</p>}
                  <button type="submit" disabled={busy || otp.length !== 6} className={primaryBtn} style={primaryStyle}>{busy ? "Checking…" : "Verify code"}</button>
                </form>
              )}

              {view === "reset-new" && (
                <form onSubmit={doReset} className="space-y-3">
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" autoComplete="new-password" aria-label="New password" minLength={6} required className={input} />
                  {error && <p className="text-xs text-p0">{error}</p>}
                  <button type="submit" disabled={busy} className={primaryBtn} style={primaryStyle}>{busy ? "Updating…" : "Update password"}</button>
                </form>
              )}

              {view === "reset-done" && (
                <button onClick={() => go("login")} className={primaryBtn} style={primaryStyle}>Back to sign in</button>
              )}
            </div>
          </div>
        </div>

        {/* Footer switch */}
        {(view === "login" || view === "signup") && (
          <div className="border-t border-line px-6 py-4 text-center text-sm text-muted">
            {view === "login" ? (
              <>New to AIQA? <button onClick={() => go("signup")} className="text-accent hover:text-accent-hover">Create an account</button></>
            ) : (
              <>Already have an account? <button onClick={() => go("login")} className="text-accent hover:text-accent-hover">Sign in</button></>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
