/* Minimal inline icon set (stroke-based, currentColor). */

type P = { className?: string };
const base = "h-[18px] w-[18px]";

export const IconDashboard = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IconProjects = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const IconRuns = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21a9 9 0 1 0-9-9" />
    <path d="M3 12l2.5-2.5M3 12 5.5 14.5" />
    <path d="M12 8v4l3 2" />
  </svg>
);

export const IconBug = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="6" width="8" height="12" rx="4" />
    <path d="M9 3l1.5 2M15 3l-1.5 2M3 10h3M18 10h3M3 15h3M18 15h3M12 6v12" />
  </svg>
);

export const IconShield = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconA11y = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4.5" r="1.6" />
    <path d="M5 8h14M12 8v6M12 14l-3 6M12 14l3 6" />
  </svg>
);

export const IconPerf = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 20a7 7 0 1 1 14 0" />
    <path d="M12 13l4-4" />
    <path d="M3 20h18" />
  </svg>
);

export const IconCode = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14" />
  </svg>
);

export const IconEye = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconPlus = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconChevron = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconExternal = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);
