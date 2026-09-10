/* ------------------------------------------------------------------ *
 * AIQA domain model.
 *
 * These types define the contract the UI renders against. Today they
 * are populated by the mock layer in `lib/mock-data.ts`; when the real
 * backend lands, only `lib/data.ts` changes — these shapes stay put.
 * ------------------------------------------------------------------ */

export type Severity = "P0" | "P1" | "P2" | "P3";

export type Confidence =
  | "confirmed"
  | "high"
  | "medium"
  | "low"
  | "suspected";

export type BugCategory =
  | "functional"
  | "ui"
  | "api"
  | "security"
  | "business-logic"
  | "workflow"
  | "data-consistency"
  | "performance"
  | "accessibility"
  | "regression";

export type TestMode =
  | "quick"
  | "standard"
  | "deep"
  | "security"
  | "business-logic"
  | "full-autonomous";

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type Environment = "production" | "staging" | "local" | "qa";

/* ---- Evidence ---------------------------------------------------- */

export interface NetworkEvidence {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  requestBody?: string;
  responseBody?: string;
}

export interface ConsoleEvidence {
  level: "log" | "info" | "warn" | "error";
  message: string;
  at: string;
}

export interface ReproStep {
  n: number;
  action: string;
  target?: string;
  detail?: string;
}

export interface Evidence {
  screenshotLabel?: string;
  screenshotUrl?: string; // served path of the captured screenshot
  domSnapshot?: string;
  network?: NetworkEvidence[];
  console?: ConsoleEvidence[];
  expected?: string;
  actual?: string;
  relevantState?: Record<string, string>;
}

/* ---- Bug --------------------------------------------------------- */

export interface Bug {
  id: string;
  projectId: string;
  runId: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  category: BugCategory;
  affectedUrl?: string;
  affectedApi?: string;
  environment: Environment;
  createdAt: string;
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
  reproSteps: ReproStep[];
  evidence: Evidence;
  impact: string;
  suggestedFix?: string;
  frequency?: string; // e.g. "3/3 reproductions"
  relatedBugIds?: string[];
  isRegression?: boolean;
  status: "open" | "verifying" | "confirmed" | "dismissed" | "fixed";
}

/* ---- Coverage ---------------------------------------------------- */

export interface CoverageMetric {
  label: string;
  discovered: number;
  tested: number;
}

export interface Coverage {
  pages: CoverageMetric;
  buttons: CoverageMetric;
  forms: CoverageMetric;
  apis: CoverageMetric;
  workflows: CoverageMetric;
}

/* ---- Application map --------------------------------------------- */

export interface AppMapNode {
  id: string;
  label: string;
  path: string;
  kind: "page" | "auth" | "api" | "admin" | "flow";
  bugCount: number;
  worstSeverity?: Severity;
  children?: AppMapNode[];
}

/* ---- Test run ---------------------------------------------------- */

export interface RunPhase {
  name: string;
  status: "pending" | "active" | "done";
  detail?: string;
}

export interface TestRun {
  id: string;
  projectId: string;
  mode: TestMode;
  status: RunStatus;
  environment: Environment;
  startedAt: string;
  finishedAt?: string;
  progress: number; // 0-100
  instruction?: string;
  bugCounts: Record<Severity, number>;
  coverage: Coverage;
  phases: RunPhase[];
  actionsExecuted: number;
  durationMs?: number;
}

/* ---- Project ----------------------------------------------------- */

export interface Project {
  id: string;
  name: string;
  url: string;
  environment: Environment;
  createdAt: string;
  lastScanAt?: string;
  appType: string;
  roles: string[];
  openBugs: number;
  criticalBugs: number;
  coverage: Coverage;
  healthScore: number; // 0-100
}

/* ---- Dashboard rollups ------------------------------------------- */

/* ---- Code review ------------------------------------------------- */

export type CodeFindingCategory =
  | "syntax"
  | "logic"
  | "bug"
  | "security"
  | "performance"
  | "formatting"
  | "style"
  | "best-practice";

export interface CodeFinding {
  id: string;
  title: string;
  severity: Severity;
  category: CodeFindingCategory;
  line?: number;
  description: string;
  suggestion: string;
  correctedSnippet?: string;
  source: "deterministic" | "ai";
}

export interface CodeReviewRequest {
  code: string;
  language: string;
  filename?: string;
  instruction?: string;
}

export interface CodeReviewResult {
  language: string;
  filename?: string;
  summary: string;
  findings: CodeFinding[];
  correctedCode?: string;
  llmUsed: boolean;
  note?: string;
}

export interface RepoFileReview {
  path: string;
  language: string;
  findings: CodeFinding[];
  correctedCode?: string;
}

export interface RepoReviewRequest {
  repoUrl: string;
  subpath?: string;
  maxFiles?: number;
  githubToken?: string;
}

export interface RepoReviewResult {
  repo: string;
  ref: string;
  summary: string;
  filesReviewed: number;
  filesAvailable: number;
  files: RepoFileReview[];
  llmUsed: boolean;
  note?: string;
}

/* ---- Visual UI review (vision model) ---------------------------- */

export type UICategory =
  | "layout"
  | "overflow"
  | "alignment"
  | "contrast"
  | "spacing"
  | "responsive"
  | "content"
  | "readability"
  | "other";

export interface UIFinding {
  id: string;
  title: string;
  severity: Severity;
  category: UICategory;
  location?: string;
  description: string;
  suggestion: string;
}

export interface UIReviewRequest {
  url: string;
  environment?: Environment;
  instruction?: string;
  viewport?: "desktop" | "mobile";
}

export interface UIReviewResult {
  url: string;
  viewport: string;
  summary: string;
  findings: UIFinding[];
  screenshot?: string;
  llmUsed: boolean;
  note?: string;
}

export interface DashboardStats {
  projects: number;
  activeRuns: number;
  totalBugs: number;
  bugsBySeverity: Record<Severity, number>;
  regressions: number;
  apiHealth: number; // 0-100
  securityFindings: number;
  a11yIssues: number;
  avgCoverage: number; // 0-100
  perfScore: number; // 0-100
}
