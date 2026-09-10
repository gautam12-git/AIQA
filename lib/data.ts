/* ------------------------------------------------------------------ *
 * Data-access selector — THE single swap point.
 *
 * The whole app imports its data functions from here. It delegates to
 * either the mock source or the real API source based on one env var:
 *
 *   NEXT_PUBLIC_USE_MOCK=false   → real FastAPI backend (lib/data-api)
 *   (unset / anything else)      → mock data          (lib/data-mock)
 *
 * Switching the entire frontend onto the live backend is this flag —
 * no page or component changes. See CONTRACT.md.
 * ------------------------------------------------------------------ */

import * as mock from "@/lib/data-mock";
import * as api from "@/lib/data-api";

const useMock = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const source = useMock ? mock : api;

export const getDashboardStats = source.getDashboardStats;
export const getProjects = source.getProjects;
export const getProject = source.getProject;
export const getRuns = source.getRuns;
export const getRun = source.getRun;
export const getBugs = source.getBugs;
export const getBug = source.getBug;
export const getAppMap = source.getAppMap;

// Write actions route through the same swap point. Against the real API they
// POST; in mock mode they throw a clear "needs live backend" error instead of
// silently hitting a backend that isn't running.
export const startScan = source.startScan;
export const cancelRun = source.cancelRun;
export const reviewCode = source.reviewCode;
export const reviewRepo = source.reviewRepo;
export const runUIReview = source.runUIReview;
export type { StartScanInput } from "@/lib/data-api";
