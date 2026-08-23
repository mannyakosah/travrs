"""HTTP API for the same inspect pipeline the CLI uses.

    cd backend && pip install -e ".[web]"
    travrs-serve
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from queue import Queue
from threading import Thread
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from travrs.env import apply_defaults
from travrs.pipeline import JOURNEY, inspect

Fmt = Literal["hgvs", "spdi", "gnomad", "vrs"]
_MAX_INPUT = 10_000


def _cache():
    from diskcache import Cache

    root = Path(os.environ.get("TRAVRS_CACHE_DIR", ".cache/travrs"))
    root.mkdir(parents=True, exist_ok=True)
    return Cache(str(root))


@asynccontextmanager
async def lifespan(app: FastAPI):
    apply_defaults()
    try:
        from travrs.pipeline import get_services

        get_services()
    except Exception:
        # First request will retry; do not fail process startup.
        pass
    app.state.cache = _cache()
    yield
    app.state.cache.close()


app = FastAPI(
    title="traVRS",
    summary="traVRS (pronounced traverse) — inspect a variant as a VRS Allele",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class InspectRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=_MAX_INPUT)
    format: Fmt | None = None
    fmt: Fmt | None = None
    no_cache: bool = False

    def resolved_fmt(self) -> Fmt | None:
        return self.format or self.fmt


def _inspect_payload(
    raw: str,
    fmt: Fmt | None,
    cache,
    on_stage=None,
    on_progress=None,
    no_cache: bool = False,
) -> dict[str, Any]:
    # v3: paper links dropped from per-step refs
    key = f"v3::{fmt or 'auto'}::{raw.strip()}"
    use_cache = os.environ.get("TRAVRS_NO_CACHE") != "1" and not no_cache
    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            payload = dict(cached)
            payload["cached"] = True
            if on_stage is not None:
                for name in JOURNEY:
                    on_stage(name)
            return payload

    result = inspect(
        raw,
        fmt=fmt,
        include_trace=True,
        on_stage=on_stage,
        on_progress=on_progress,
    )
    payload = result.to_dict()
    payload["cached"] = False
    if use_cache and (result.vrs_id or result.allele_json):
        cache.set(key, payload, expire=int(os.environ.get("TRAVRS_CACHE_TTL", "86400")))
    return payload


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "traVRS",
        "pronunciation": "traverse",
        "docs": "/docs",
        "inspect": "POST /api/inspect",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/inspect")
def api_inspect(body: InspectRequest) -> dict[str, Any]:
    text = body.input.strip()
    if not text:
        raise HTTPException(status_code=422, detail="input is empty")
    return _inspect_payload(
        text, body.resolved_fmt(), app.state.cache, no_cache=body.no_cache
    )


@app.post("/api/inspect/stream")
def api_inspect_stream(body: InspectRequest):
    text = body.input.strip()
    if not text:
        raise HTTPException(status_code=422, detail="input is empty")

    cache = app.state.cache
    fmt = body.resolved_fmt()

    def events():
        q: Queue = Queue()

        def on_stage(name: str) -> None:
            q.put({"type": "stage", "stage": name})

        def on_progress(message: str) -> None:
            q.put({"type": "progress", "message": message})

        def work() -> None:
            try:
                payload = _inspect_payload(
                    text,
                    fmt,
                    cache,
                    on_stage=on_stage,
                    on_progress=on_progress,
                    no_cache=body.no_cache,
                )
                q.put({"type": "result", "payload": payload})
            except Exception as exc:  # noqa: BLE001
                q.put({"type": "error", "detail": f"{type(exc).__name__}: {exc}"})
            finally:
                q.put(None)

        Thread(target=work, daemon=True).start()
        while True:
            item = q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def main() -> None:
    import uvicorn

    apply_defaults()
    uvicorn.run(
        "travrs.api:app",
        host=os.environ.get("TRAVRS_HOST", "127.0.0.1"),
        port=int(os.environ.get("TRAVRS_PORT", "8000")),
        reload=os.environ.get("TRAVRS_RELOAD", "1") == "1",
    )


if __name__ == "__main__":
    main()
