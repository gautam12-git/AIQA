"""Code Review engine — analyze source code, not a deployed site.

Two layers, same hybrid philosophy as the site scanner:
  - Deterministic: real syntax parsing where we can (Python AST, JSON) plus
    language-agnostic structural/style checks. Cheap, exact, no LLM.
  - AI (GLM): deep review of logic, bugs, security, best practices, and a
    fully corrected version of the file. Degrades gracefully when the LLM
    is unavailable — deterministic findings still return.
"""

from __future__ import annotations

import ast
import json
import re

from app.llm.client import get_llm
from app.schemas import CodeFinding, CodeReviewRequest, CodeReviewResult

_EXT = {
    "py": "python", "js": "javascript", "jsx": "javascript", "ts": "typescript",
    "tsx": "typescript", "json": "json", "java": "java", "go": "go", "rb": "ruby",
    "php": "php", "cs": "csharp", "c": "c", "cpp": "cpp", "cc": "cpp", "h": "c",
    "rs": "rust", "kt": "kotlin", "swift": "swift", "html": "html", "css": "css",
    "sql": "sql", "sh": "bash", "yml": "yaml", "yaml": "yaml",
}


def resolve_language(language: str, filename: str | None, code: str = "") -> str:
    if language and language != "auto":
        return language
    if filename and "." in filename:
        return _EXT.get(filename.rsplit(".", 1)[-1].lower(), "text")
    return _sniff(code)


def _sniff(code: str) -> str:
    """Best-effort language detection from code content (auto, no filename)."""
    s = code.strip()
    if not s:
        return "text"
    if (s[0] in "{[") and _looks_json(s):
        return "json"
    # Python — recognize keywords even if the snippet has a syntax error.
    if re.search(r"^\s*def\s+\w+\s*\(|^\s*class\s+\w+|^\s*(from|import)\s+\w|^\s*print\s*\(|^\s*(async\s+def|elif|except)\b",
                 code, re.M):
        return "python"
    if re.search(r"\b(function|const|let|var)\b|=>|console\.log", code):
        return "typescript" if re.search(r":\s*(string|number|boolean|any)\b|interface\s+\w", code) else "javascript"
    if re.search(r"\bpackage\s+main\b|func\s+\w+\s*\(", code):
        return "go"
    if re.search(r"\b(public|private|protected)\s+(class|static)\b|System\.out", code):
        return "java"
    if re.search(r"#include\b|std::", code):
        return "cpp"
    return "text"


def _looks_json(s: str) -> bool:
    try:
        json.loads(s)
        return True
    except Exception:
        return '"' in s and (":" in s or "," in s)


class _Seq:
    def __init__(self):
        self.n = 0

    def next(self) -> str:
        self.n += 1
        return f"CR-{self.n:03d}"


def deterministic(code: str, language: str, seq: _Seq) -> list[CodeFinding]:
    findings: list[CodeFinding] = []
    lines = code.splitlines()

    # --- Real syntax checks where we have a parser ---
    if language == "python":
        try:
            ast.parse(code)
        except SyntaxError as e:
            findings.append(CodeFinding(
                id=seq.next(), title=f"Python syntax error: {e.msg}", severity="P1",
                category="syntax", line=e.lineno,
                description=f"The code does not parse: {e.msg} (line {e.lineno}).",
                suggestion="Fix the syntax so the module parses.", source="deterministic"))
    elif language == "json":
        try:
            json.loads(code)
        except json.JSONDecodeError as e:
            findings.append(CodeFinding(
                id=seq.next(), title=f"Invalid JSON: {e.msg}", severity="P1", category="syntax",
                line=e.lineno, description=f"JSON does not parse: {e.msg} (line {e.lineno}).",
                suggestion="Correct the JSON structure.", source="deterministic"))

    # --- Language-agnostic structural checks ---
    if language in ("python", "javascript", "typescript", "java", "go", "c", "cpp",
                    "csharp", "rust", "json", "php", "css"):
        bal = _bracket_balance(code)
        if bal:
            findings.append(CodeFinding(
                id=seq.next(), title=f"Unbalanced {bal}", severity="P1", category="syntax",
                description=f"Detected an unbalanced {bal} in the source.",
                suggestion="Check that every opening bracket has a matching close.",
                source="deterministic"))

    # --- Style / formatting ---
    for i, ln in enumerate(lines, start=1):
        if len(ln) > 120:
            findings.append(CodeFinding(
                id=seq.next(), title="Line exceeds 120 characters", severity="P3",
                category="formatting", line=i,
                description=f"Line {i} is {len(ln)} characters.",
                suggestion="Wrap or refactor for readability.", source="deterministic"))
            break  # one is enough to flag the habit
    if any(ln.rstrip() != ln for ln in lines):
        findings.append(CodeFinding(
            id=seq.next(), title="Trailing whitespace", severity="P3", category="formatting",
            description="One or more lines have trailing whitespace.",
            suggestion="Strip trailing whitespace (most formatters do this automatically).",
            source="deterministic"))
    todos = [i for i, ln in enumerate(lines, 1) if re.search(r"\b(TODO|FIXME|XXX)\b", ln)]
    if todos:
        findings.append(CodeFinding(
            id=seq.next(), title=f"{len(todos)} unresolved TODO/FIXME marker(s)", severity="P3",
            category="best-practice", line=todos[0],
            description="Unresolved markers left in the code.",
            suggestion="Resolve or track these before shipping.", source="deterministic"))

    return findings


def _bracket_balance(code: str) -> str | None:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[str] = []
    in_str = None
    prev = ""
    for ch in code:
        if in_str:
            if ch == in_str and prev != "\\":
                in_str = None
        elif ch in ("'", '"', "`"):
            in_str = ch
        elif ch in "([{":
            stack.append(ch)
        elif ch in ")]}":
            if not stack or stack[-1] != pairs[ch]:
                return {"(": "parenthesis", "[": "bracket", "{": "brace"}.get(pairs[ch], "bracket")
            stack.pop()
        prev = ch
    if stack:
        return {"(": "parenthesis", "[": "bracket", "{": "brace"}[stack[-1]]
    return None


_SYSTEM = """You are AIQA's senior code reviewer. Review the user's source code for
correctness bugs, logic errors, security issues, performance problems, and style.

Respond with ONLY a JSON object (no prose, no markdown fences) of this shape:
{
  "summary": "one-paragraph assessment",
  "findings": [
    {"title": "...", "severity": "P0|P1|P2|P3", "category": "syntax|logic|bug|security|performance|formatting|style|best-practice",
     "line": <int or null>, "description": "...", "suggestion": "...", "correctedSnippet": "corrected code for this spot or null"}
  ],
  "correctedCode": "the FULL corrected file"
}
Be precise and evidence-based. Prefer fewer, high-confidence findings over noise."""


async def llm_review(code: str, language: str, filename: str | None, instruction: str | None, seq: _Seq):
    llm = get_llm()
    if not llm.configured:
        return None, None, None, "LLM not configured — deterministic checks only."

    user = (f"Language: {language}\nFile: {filename or 'snippet'}\n"
            f"{'Focus: ' + instruction if instruction else ''}\n\nCODE:\n```\n{code[:12000]}\n```")
    try:
        resp = await llm.chat(messages=[{"role": "system", "content": _SYSTEM},
                                        {"role": "user", "content": user}], temperature=0.1)
        content = (resp.get("choices") or [{}])[0].get("message", {}).get("content") or ""
        data = _parse_json(content)
        if not data:
            return [], None, None, "LLM returned an unparseable response."
        findings = []
        for f in data.get("findings", [])[:40]:
            findings.append(CodeFinding(
                id=seq.next(), title=str(f.get("title", "Issue"))[:200],
                severity=f.get("severity") if f.get("severity") in ("P0", "P1", "P2", "P3") else "P2",
                category=f.get("category") if f.get("category") in (
                    "syntax", "logic", "bug", "security", "performance", "formatting", "style", "best-practice") else "logic",
                line=f.get("line") if isinstance(f.get("line"), int) else None,
                description=str(f.get("description", ""))[:1500],
                suggestion=str(f.get("suggestion", ""))[:1500],
                corrected_snippet=(str(f["correctedSnippet"])[:4000] if f.get("correctedSnippet") else None),
                source="ai"))
        return findings, data.get("correctedCode"), data.get("summary"), None
    except Exception as exc:
        return [], None, None, f"AI review unavailable: {str(exc)[:120]}"


def _parse_json(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


async def analyze(req: CodeReviewRequest) -> CodeReviewResult:
    language = resolve_language(req.language, req.filename, req.code)
    seq = _Seq()
    det = deterministic(req.code, language, seq)
    ai_findings, corrected, ai_summary, note = await llm_review(
        req.code, language, req.filename, req.instruction, seq)

    findings = det + (ai_findings or [])
    order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    findings.sort(key=lambda f: order[f.severity])

    llm_used = ai_findings is not None and note is None
    summary = ai_summary or (
        f"{len(findings)} issue(s) found by deterministic checks. "
        + (note or ""))
    return CodeReviewResult(
        language=language, filename=req.filename, summary=summary.strip(),
        findings=findings, corrected_code=corrected, llm_used=bool(llm_used), note=note)
