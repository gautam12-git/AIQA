# AIQA — Autonomous AI QA Engineer

AIQA takes a URL and autonomously explores, tests, and reports **replay-verified**
defects across UI, security, accessibility, performance, and business logic —
with evidence attached to every finding. It also includes a **Code Review** mode
for source files and public GitHub repositories.

Its guiding principle is a **low false-positive rate**: nothing is reported until
it has been reproduced by replay.

## Features

- **Autonomous crawl & test** of any URL (Playwright / Chromium)
- **Hybrid detection** — deterministic detectors + LLM-guided exploration:
  - Accessibility (WCAG DOM checks), performance (LCP / TTFB web vitals),
    broken pages & images, console / JS errors, missing security headers,
    insecure CORS, IDOR / broken-access, and form-validation gaps
- **Replay-verification engine** — each finding is reproduced before it surfaces
- **Evidence capture** — screenshots, console, network, and DOM
- **Authenticated testing** (login) with basic cross-user (IDOR) checks
- **Vision model** for visual UI bugs
- **Code Review mode** — paste code or point it at a public GitHub repo
- **Live run streaming** (SSE) and **MySQL** persistence

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Playwright, SQLAlchemy (async), MySQL
- **AI:** OpenAI-compatible LLM providers + a vision model

## Architecture

```
discover (crawl)  →  detect (deterministic + AI)  →  verify by replay  →  report
```

- `backend/app/services/` — browser, detectors, verifier, auth, orchestrator, code_review …
- `lib/data.ts` — single data-source swap point (mock ↔ real API)

## Running locally

### Backend
```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
cp .env.example .env        # fill in LLM keys + MySQL credentials
uvicorn app.main:app --port 8010
```

### Frontend
```bash
npm install
# in .env.local:
#   NEXT_PUBLIC_USE_MOCK=false
#   NEXT_PUBLIC_API_URL=http://127.0.0.1:8010
npm run dev
```

## Notes

- Secrets live only in a gitignored `.env` — never committed.
- Only test websites you are authorized to test.
