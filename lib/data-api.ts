import type {
  Bug, Project, TestRun, AppMapNode, DashboardStats,
  CodeReviewRequest, CodeReviewResult, RepoReviewRequest, RepoReviewResult,
} from "@/lib/types";
import { apiBase } from "@/lib/api-base";

/* ------------------------------------------------------------------ *
 * Real API data source. Implements the AIQA API contract (CONTRACT.md)
 * against the FastAPI backend. Enabled with NEXT_PUBLIC_USE_MOCK=false.
 *
 * Every failure resolves to a polite, human-readable message — callers
 * can surface `error.message` directly without leaking status codes or
 * internals.
 * ------------------------------------------------------------------ */

const NETWORK_MSG =
  "We couldn't reach the server. Please check your connection and try again.";

const FRIENDLY: Record<number, string> = {
  400: "That request couldn't be processed. Please check your input and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have access to that.",
  404: "We couldn't find what you were looking for.",
  408: "That took too long. Please try again.",
  429: "You're going a little fast — please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again in a moment.",
  502: "The server is temporarily unavailable. Please try again shortly.",
  503: "The service is busy right now. Please try again shortly.",
  504: "The server took too long to respond. Please try again.",
};

/** Prefer the backend's polite message; fall back to a friendly status message. */
function friendly(status: number, backendMsg?: string | null): string {
  if (backendMsg && backendMsg.trim()) return backendMsg.trim();
  return FRIENDLY[status] ?? "Something went wrong. Please try again.";
}

async function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const suffix = qs.toString() ? `?${qs}` : "";

  const headers: Record<string, string> = { Accept: "application/json" };
  // In a Server Component, forward the caller's session cookie to the (now
  // protected) backend — SSR fetch does not carry the browser's cookies.
  if (typeof window === "undefined") {
    const mod = "next/headers";
    const { cookies } = await import(mod);
    const cookieHeader = (await cookies()).toString();
    if (cookieHeader) headers["Cookie"] = cookieHeader;
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api${path}${suffix}`, {
      headers,
      credentials: "include",
      cache: "no-store", // always hit the backend, never Next's data cache
    });
  } catch {
    throw new Error(NETWORK_MSG);
  }

  // Session expired/invalid on the server → bounce to login.
  if (res.status === 401 && typeof window === "undefined") {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  if (res.status === 404) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(friendly(res.status, body?.error?.message));
  }
  return res.json() as Promise<T>;
}

/** POST helper for write actions: network-safe, always throws a polite message. */
async function postJson<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api${path}`, {
      method: "POST",
      credentials: "include",
      headers:
        body !== undefined
          ? { "Content-Type": "application/json", Accept: "application/json" }
          : { Accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(NETWORK_MSG);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(friendly(res.status, data?.error?.message));
  return data as T;
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
  return postJson<TestRun>(`/runs/${runId}/cancel`);
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
  return postJson<TestRun>("/scans", input);
}

/* ---- Code review (POST /api/code-reviews) ------------------------ */

export async function reviewCode(input: CodeReviewRequest): Promise<CodeReviewResult> {
  return postJson<CodeReviewResult>("/code-reviews", input);
}

/* ---- GitHub repo review (POST /api/repo-reviews) ---------------- */

export async function reviewRepo(input: RepoReviewRequest): Promise<RepoReviewResult> {
  return postJson<RepoReviewResult>("/repo-reviews", input);
}

/* ---- On-demand visual UI analysis for a run --------------------- */

export async function runUIReview(
  runId: string,
  maxPages = 3,
): Promise<{ added: number; pagesAnalyzed: number }> {
  return postJson<{ added: number; pagesAnalyzed: number }>(
    `/runs/${runId}/ui-review?max_pages=${maxPages}`,
  );
}

/* ---- Product auth (login / signup / OTP / password reset) -------- */

export interface AuthUser { name: string; email: string; }
export type AuthResult = { ok: true; user?: AuthUser; message?: string } | { ok: false; error: string };

async function authPost(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include", // send/receive the session cookie
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NETWORK_MSG };
  }
  const data = await res.json().catch(() => null);
  // Auth endpoints return { ok, error } at HTTP 200; only unexpected HTTP
  // errors (500, etc.) fall through to a status-based friendly message.
  if (!res.ok) return { ok: false, error: friendly(res.status, data?.error?.message ?? data?.error) };
  return (data as AuthResult) ?? { ok: false, error: "Something went wrong. Please try again." };
}

export const signup = (name: string, email: string, password: string) =>
  authPost("/signup", { name, email, password });
export const verifyOtp = (email: string, otp: string) => authPost("/verify-otp", { email, otp });
export const login = (email: string, password: string) => authPost("/login", { email, password });
export const logout = () => authPost("/logout", {});
export const forgotPassword = (email: string) => authPost("/forgot-password", { email });
export const verifyResetOtp = (email: string, otp: string) => authPost("/verify-reset-otp", { email, otp });
export const resetPassword = (email: string, otp: string, newPassword: string) =>
  authPost("/reset-password", { email, otp, newPassword });

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${apiBase()}/api/auth/me`, { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => null);
    return data?.ok ? (data.user as AuthUser) : null;
  } catch {
    return null;
  }
}
