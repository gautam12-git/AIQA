import type {
  Bug, Project, TestRun, AppMapNode, DashboardStats,
  CodeReviewRequest, CodeReviewResult, RepoReviewRequest, RepoReviewResult,
} from "@/lib/types";

/* ------------------------------------------------------------------ *
 * Real API data source. Implements the AIQA API contract (CONTRACT.md)
 * against the FastAPI backend. Enabled with NEXT_PUBLIC_USE_MOCK=false.
 *
 * Responses are camelCase and match `lib/types.ts` exactly, so no
 * mapping is needed — just fetch → json.
 * ------------------------------------------------------------------ */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8010";

async function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await fetch(`${API_URL}/api${path}${suffix}`, {
    headers: { Accept: "application/json" },
    // Server Components: always hit the backend, never Next's data cache.
    cache: "no-store",
  });
  if (res.status === 404) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return get<DashboardStats>("/dashboard");
}

export async function getProjects(): Promise<Project[]> {
  return get<Project[]>("/projects");
}

export async function getProject(id: string): Promise<Project | undefined> {
  return get<Project | undefined>(`/projects/${id}`);
}

export async function getRuns(projectId?: string): Promise<TestRun[]> {
  return get<TestRun[]>("/runs", { projectId });
}

export async function getRun(id: string): Promise<TestRun | undefined> {
  return get<TestRun | undefined>(`/runs/${id}`);
}

export async function cancelRun(runId: string): Promise<TestRun> {
  const res = await fetch(`${API_URL}/api/runs/${runId}/cancel`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Cancel failed: ${res.status}`);
  }
  return res.json() as Promise<TestRun>;
}

export async function getBugs(filter?: {
  projectId?: string;
  runId?: string;
  category?: string;
  severity?: string;
}): Promise<Bug[]> {
  return get<Bug[]>("/bugs", filter as Record<string, string | undefined>);
}

export async function getBug(id: string): Promise<Bug | undefined> {
  return get<Bug | undefined>(`/bugs/${id}`);
}

export async function getAppMap(projectId: string): Promise<AppMapNode | undefined> {
  return get<AppMapNode | undefined>(`/projects/${projectId}/app-map`);
}

/* ---- Write action: start a scan (POST /api/scans) ---------------- */

export interface StartScanInput {
  url: string;
  environment: string;
  mode: string;
  instruction?: string;
  authorized: boolean;
  credentials?: { label: string; username: string; password?: string }[];
}

export async function startScan(input: StartScanInput): Promise<TestRun> {
  const res = await fetch(`${API_URL}/api/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to start scan: ${res.status}`);
  }
  return res.json() as Promise<TestRun>;
}

/* ---- Code review (POST /api/code-reviews) ------------------------ */

export async function reviewCode(input: CodeReviewRequest): Promise<CodeReviewResult> {
  const res = await fetch(`${API_URL}/api/code-reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Code review failed: ${res.status}`);
  }
  return res.json() as Promise<CodeReviewResult>;
}

/* ---- GitHub repo review (POST /api/repo-reviews) ---------------- */

export async function reviewRepo(input: RepoReviewRequest): Promise<RepoReviewResult> {
  const res = await fetch(`${API_URL}/api/repo-reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Repo review failed: ${res.status}`);
  }
  return res.json() as Promise<RepoReviewResult>;
}

/* ---- On-demand visual UI analysis for a run --------------------- */

export async function runUIReview(
  runId: string,
  maxPages = 3,
): Promise<{ added: number; pagesAnalyzed: number }> {
  const res = await fetch(`${API_URL}/api/runs/${runId}/ui-review?max_pages=${maxPages}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `UI analysis failed: ${res.status}`);
  }
  return res.json();
}
