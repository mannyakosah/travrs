import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from travrs.detect import Detection
from travrs.pipeline import JOURNEY, InspectResult


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("TRAVRS_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setenv("TRAVRS_NO_CACHE", "0")

    def fake_inspect(raw, fmt=None, on_progress=None, on_stage=None, include_trace=False):
        if on_stage:
            for name in JOURNEY:
                on_stage(name)
        return InspectResult(
            input=raw.strip(),
            detection=Detection("hgvs", "HGVS coding / transcript (NM_007294.4:c.)"),
            allele_json={"type": "Allele"},
            vrs_id="ga4gh:VA.0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD",
            versions={"travrs": "0.1.0"},
        )

    monkeypatch.setattr("travrs.api.inspect", fake_inspect)
    monkeypatch.setattr("travrs.pipeline.get_services", lambda *args, **kwargs: (None, None))

    from travrs.api import app

    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_versions(client):
    body = client.get("/api/versions").json()
    assert "vrs_python" in body
    assert "travrs" in body


def test_inspect_returns_id(client):
    response = client.post(
        "/api/inspect",
        json={"input": "NM_007294.4:c.68_69del"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "ga4gh:VA.0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD"
    assert body["detected_format"] == "hgvs"
    assert body["cached"] is False
    assert "trace" in body
    assert "versions" in body


def test_inspect_caches_second_call(client):
    payload = {"input": "NM_007294.4:c.68_69del"}
    first = client.post("/api/inspect", json=payload).json()
    second = client.post("/api/inspect", json=payload).json()
    assert first["cached"] is False
    assert second["cached"] is True
    assert second["id"] == first["id"]


def test_inspect_no_cache_skips_store_lookup(client):
    payload = {"input": "NM_007294.4:c.68_69del"}
    client.post("/api/inspect", json=payload)
    bypassed = client.post("/api/inspect", json={**payload, "no_cache": True}).json()
    assert bypassed["cached"] is False


def test_inspect_stream_emits_stages_then_result(client):
    response = client.post(
        "/api/inspect/stream",
        json={"input": "NM_007294.4:c.68_69del"},
    )
    assert response.status_code == 200
    stages = []
    result = None
    for block in response.text.strip().split("\n\n"):
        line = next((ln for ln in block.split("\n") if ln.startswith("data: ")), None)
        if not line:
            continue
        event = json.loads(line[6:])
        if event["type"] == "stage":
            stages.append(event["stage"])
        if event["type"] == "result":
            result = event["payload"]
    assert stages == list(JOURNEY)
    assert result["id"] == "ga4gh:VA.0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD"


def test_inspect_rejects_empty(client):
    response = client.post("/api/inspect", json={"input": "   "})
    assert response.status_code == 422


def test_example_contract_is_valid_json():
    path = Path(__file__).resolve().parents[1] / "examples" / "inspect-response.json"
    data = json.loads(path.read_text())
    assert data["id"].startswith("ga4gh:VA.")
    assert data["detected_format"] == "hgvs"
