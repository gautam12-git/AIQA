import {
  projects,
  runs,
  bugs,
  appMaps,
  computeDashboardStats,
} from "@/lib/mock-data";
import type {
  Bug, Project, TestRun, AppMapNode, DashboardStats,
  CodeReviewResult, RepoReviewResult,
} from "@/lib/types";
import type { StartScanInput } from "@/lib/data-api";

/* Write actions require the live backend. In mock mode they fail loudly with
 * a clear message instead of silently hanging against a backend that isn't
 * there — so mock mode never dead-ends. Flip NEXT_PUBLIC_USE_MOCK=false. */
const MOCK_WRITE = "This action needs the live backend. Set NEXT_PUBLIC_USE_MOCK=false and start the API.";

/* ------------------------------------------------------------------ *
 * Mock data source. Backs the UI until the real API is switched on via
 * NEXT_PUBLIC_USE_MOCK=false. Mirrors the shapes in `lib/data-api.ts`.
 * ------------------------------------------------------------------ */

export async function getDashboardStats(): Promise<DashboardStats> {
  return computeDashboardStats();
}

export async function getProjects(): Promise<Project[]> {
  return projects;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return projects.find((p) => p.id === id);
}

export async function getRuns(projectId?: string): Promise<TestRun[]> {
  const list = projectId ? runs.filter((r) => r.projectId === projectId) : runs;
  return [...list].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getRun(id: string): Promise<TestRun | undefined> {
  return runs.find((r) => r.id === id);
}

export async function getBugs(filter?: {
  projectId?: string;
  runId?: string;
  category?: string;
  severity?: string;
}): Promise<Bug[]> {
  let list = bugs;
  if (filter?.projectId) list = list.filter((b) => b.projectId === filter.projectId);
  if (filter?.runId) list = list.filter((b) => b.runId === filter.runId);
  if (filter?.category) list = list.filter((b) => b.category === filter.category);
  if (filter?.severity) list = list.filter((b) => b.severity === filter.severity);
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...list].sort(
    (a, b) => order[a.severity] - order[b.severity] || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getBug(id: string): Promise<Bug | undefined> {
  return bugs.find((b) => b.id === id);
}

export async function getAppMap(projectId: string): Promise<AppMapNode | undefined> {
  return appMaps[projectId];
}

/* ---- Write actions (no backend in mock mode) --------------------- */

export async function startScan(_input: StartScanInput): Promise<TestRun> {
  throw new Error(MOCK_WRITE);
}

export async function cancelRun(_runId: string): Promise<TestRun> {
  throw new Error(MOCK_WRITE);
}

export async function reviewCode(): Promise<CodeReviewResult> {
  throw new Error(MOCK_WRITE);
}

export async function reviewRepo(): Promise<RepoReviewResult> {
  throw new Error(MOCK_WRITE);
}

export async function runUIReview(): Promise<{ added: number; pagesAnalyzed: number }> {
  throw new Error(MOCK_WRITE);
}
