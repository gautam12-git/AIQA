import Link from "next/link";
import { Donut } from "@/components/ui/primitives";
import {
  IconShield, IconA11y, IconPerf, IconCode, IconEye, IconBug, IconChevron,
} from "@/components/layout/icons";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthDrawer } from "@/components/auth/auth-drawer";
import { LogoMark } from "@/components/layout/logo";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const { auth } = await searchParams;
  const autoOpen = auth === "login" || auth === "signup" || auth === "forgot";
  const initialMode = (auth as "login" | "signup" | "forgot") || "login";

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AuthDrawer autoOpen={autoOpen} initialMode={initialMode} />
      {/* ---- Nav ---- */}
      <header className="glass sticky top-0 z-30 border-b">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9 rounded-xl" />
            <span className="text-lg font-semibold tracking-tight text-content">AIQA</span>
          </Link>
          <div className="ml-auto hidden items-center gap-7 text-sm text-secondary md:flex">
            <a href="#features" className="transition-colors hover:text-content">Features</a>
            <a href="#how" className="transition-colors hover:text-content">How it works</a>
            <a href="#moat" className="transition-colors hover:text-content">Why AIQA</a>
          </div>
          <div className="ml-auto flex items-center gap-2.5 md:ml-0">
            <AuthButton mode="login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-secondary transition-colors hover:text-content">Sign in</AuthButton>
            <AuthButton mode="signup" className="grad-brand rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(236,72,153,0.5)] transition-all hover:brightness-110">
              Get started
            </AuthButton>
          </div>
        </nav>
      </header>

      {/* ---- Hero ---- */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
        <div className="aiqa-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs font-medium text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-success aiqa-pulse" />
            Autonomous AI QA · evidence-first
          </span>
          <h1 className="mt-5 text-[42px] font-bold leading-[1.05] tracking-tight text-content sm:text-[56px]">
            Find the bugs<br />
            <span className="gradient-text">your tests miss.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-secondary sm:text-lg">
            Give AIQA a URL. It explores like a senior QA engineer, then reports
            <span className="text-content"> replay-verified </span>
            defects across UI, security, accessibility, and performance — each backed by evidence,
            with the lowest false-positive rate.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AuthButton mode="signup" className="grad-brand inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(236,72,153,0.55)] transition-all hover:brightness-110">
              Start free <IconChevron className="h-4 w-4" />
            </AuthButton>
            <AuthButton mode="login" className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold text-content transition-colors hover:bg-surface-2">
              Sign in
            </AuthButton>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-xs text-muted">
            <Stat k="10+" v="bug categories" />
            <Stat k="Replay" v="verified findings" />
            <Stat k="UI · API" v="a11y · perf · security" />
          </div>
        </div>

        {/* Product preview */}
        <div className="aiqa-fade-up">
          <ReportPreview />
        </div>
      </section>

      {/* ---- Features ---- */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <SectionTitle eyebrow="Capabilities" title="One scan. Every kind of bug." sub="Deterministic detectors run always; an AI agent explores the rest. Everything is verified before it surfaces." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<IconBug />} title="Replay-verification" desc="Every finding is reproduced before it's reported. Unreproducible AI guesses are dropped — that's the low false-positive moat." />
          <Feature icon={<IconEye />} title="Vision UI detection" desc="A vision model reviews real screenshots to catch layout, overflow, and contrast issues humans notice instantly." />
          <Feature icon={<IconShield />} title="Security checks" desc="Missing headers, insecure CORS, IDOR / broken-access, and object-level authorization flaws across your API." />
          <Feature icon={<IconA11y />} title="Accessibility (WCAG)" desc="Real DOM audits: missing alt text, unlabeled inputs, poor names, and document-level a11y gaps." />
          <Feature icon={<IconPerf />} title="Performance / Web Vitals" desc="Measures LCP and TTFB on real page loads and flags slow, conversion-killing routes." />
          <Feature icon={<IconCode />} title="Code Review" desc="Point it at source or a GitHub repo for logic, syntax, and style findings — with corrected code." />
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section id="how" className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <SectionTitle eyebrow="The pipeline" title="How AIQA works" sub="The same discipline a great QA engineer uses — automated." />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <Step n="1" title="Discover" desc="Crawls your app, mapping pages, forms, and API calls." />
            <Step n="2" title="Detect" desc="Deterministic detectors + an AI agent surface suspected defects." />
            <Step n="3" title="Verify by replay" desc="Each finding is re-run to confirm it actually reproduces." />
            <Step n="4" title="Report" desc="Verified defects with screenshots, network, and repro steps." />
          </div>
        </div>
      </section>

      {/* ---- Moat ---- */}
      <section id="moat" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="glass hairline-top overflow-hidden rounded-[var(--radius-card)] border p-8 sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
                A scanner is noisy.<br /><span className="gradient-text">AIQA is trustworthy.</span>
              </h2>
              <p className="mt-4 max-w-lg text-secondary">
                The difference between a tool you ignore and one you trust is the false-positive rate.
                AIQA refuses to report a defect until it reproduces — so what lands in your report is real,
                with the evidence to prove it.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <BigStat k="0 FP" v="unverified guesses dropped" />
              <BigStat k="1-click" v="re-run any finding" />
              <BigStat k="Full" v="evidence per bug" />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="grad-brand relative overflow-hidden rounded-[var(--radius-card)] px-8 py-14 text-center shadow-[0_24px_60px_-24px_rgba(236,72,153,0.5)]">
          <h2 className="text-3xl font-bold tracking-tight text-white">Ship with confidence.</h2>
          <p className="mx-auto mt-3 max-w-md text-white/85">
            Point AIQA at your app and get a verified defect report in minutes.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <AuthButton mode="signup" className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#7c3aed] transition-transform hover:scale-[1.03]">
              Get started free
            </AuthButton>
            <AuthButton mode="login" className="rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
              Sign in
            </AuthButton>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7 rounded-lg" />
            <span className="font-medium text-secondary">AIQA — Autonomous AI QA Engineer</span>
          </div>
          <div className="flex items-center gap-6">
            <AuthButton mode="login" className="transition-colors hover:text-content">Sign in</AuthButton>
            <AuthButton mode="signup" className="transition-colors hover:text-content">Get started</AuthButton>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- bits */

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold text-content">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-content">{title}</h2>
      <p className="mt-3 text-secondary">{sub}</p>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card-hover rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-content">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-secondary">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="relative rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="grad-brand mb-3 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">{n}</div>
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-secondary">{desc}</p>
    </div>
  );
}

function BigStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4 text-center">
      <div className="gradient-text text-xl font-bold">{k}</div>
      <div className="mt-1 text-[11px] leading-tight text-muted">{v}</div>
    </div>
  );
}

function ReportPreview() {
  const findings = [
    { sev: "P1", color: "var(--p1)", text: "IDOR on /api/orders/{id}", cat: "Security" },
    { sev: "P2", color: "var(--p2)", text: "Poor LCP (4.2s) on /checkout", cat: "Performance" },
    { sev: "P3", color: "var(--p3)", text: "Missing alt text on /gallery", cat: "Accessibility" },
  ];
  return (
    <div className="glass glow-accent rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success aiqa-pulse" />
          <span className="font-mono text-xs text-secondary">app.example.com</span>
        </div>
        <span className="rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">SCAN COMPLETE</span>
      </div>

      <div className="mt-5 flex items-center gap-5 border-b border-line pb-5">
        <Donut value={78} size={72} stroke={7} color="var(--accent)" />
        <div>
          <div className="text-sm text-muted">Meaningful coverage</div>
          <div className="tabular text-2xl font-semibold text-content">78%</div>
          <div className="mt-1 text-xs text-muted">3 verified defects · 12 dropped (unreproducible)</div>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {findings.map((f) => (
          <div key={f.text} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ color: f.color, background: `color-mix(in srgb, ${f.color} 15%, transparent)` }}>
              {f.sev}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-content">{f.text}</span>
            <span className="hidden text-[11px] text-muted sm:inline">{f.cat}</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-success">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              verified
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
