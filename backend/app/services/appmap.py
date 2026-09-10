"""Build an application map (tree) from a crawl.

Turns the flat list of crawled pages into a nested structure by URL path,
annotated with how many bugs live at each node and the worst severity —
so the project's Application Map reflects real scans, not just seed data.
"""

from __future__ import annotations

from urllib.parse import urlparse

from app.schemas import AppMapNode, Bug
from app.services.browser import PageReport

_SEV_RANK = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def _kind(path: str) -> str:
    p = path.lower()
    segs = [s for s in p.split("/") if s]
    auth_words = {"login", "signin", "sign-in", "auth", "register", "signup", "sign-up", "logout"}
    if any(s in auth_words for s in segs):
        return "auth"
    if "admin" in segs:
        return "admin"
    if "api" in segs:
        return "api"
    return "page"


def build_app_map(start_url: str, reports: list[PageReport], bugs: list[Bug]) -> AppMapNode:
    host = urlparse(start_url).netloc or start_url

    # bugs per URL path
    by_path: dict[str, list[Bug]] = {}
    for b in bugs:
        if b.affected_url:
            path = urlparse(b.affected_url).path or "/"
            by_path.setdefault(path, []).append(b)

    root = AppMapNode(id="root", label=host, path="/", kind="page", bug_count=0)
    index: dict[str, AppMapNode] = {"/": root}

    for rep in reports:
        path = urlparse(rep.url).path or "/"
        segments = [s for s in path.split("/") if s]
        cur = root
        built = ""
        for seg in segments:
            built += "/" + seg
            if built not in index:
                node = AppMapNode(id=built, label=seg, path=built, kind=_kind(built), bug_count=0)
                index[built] = node
                if cur.children is None:
                    cur.children = []
                cur.children.append(node)
            cur = index[built]

    # annotate bug counts / worst severity
    for path, blist in by_path.items():
        node = index.get(path)
        if node is None:
            node = root
        node.bug_count = len(blist)
        node.worst_severity = sorted(blist, key=lambda b: _SEV_RANK[b.severity])[0].severity

    return root
