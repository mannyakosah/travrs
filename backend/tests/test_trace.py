"""The trace's re-derived normalization must match ga4gh.vrs.normalize exactly.

Uses a fake dataproxy over a synthetic sequence — no network.
"""

from __future__ import annotations

import pytest
from ga4gh.core import ga4gh_identify
from ga4gh.vrs import models, normalize

from travrs.trace import _RefWindow, _summary, _trace_digest, _trace_normalization

#           0         1         2         3
#           0123456789012345678901234567890123456789
SEQ = "TTTTTCCAGAGAGTCGGGATCTTTTACGTACGTACGTTTT"


class FakeDataProxy:
    def get_sequence(self, identifier, start=None, end=None):
        return SEQ[start:end]

    def get_metadata(self, identifier):
        return {"length": len(SEQ), "aliases": []}


def make_allele(start: int, end: int, alt: str) -> models.Allele:
    return models.Allele(
        location=models.SequenceLocation(
            sequenceReference=models.SequenceReference(refgetAccession="SQ.FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE"),
            start=start,
            end=end,
        ),
        state=models.LiteralSequenceExpression(sequence=models.sequenceString(alt)),
    )


def derive(start: int, end: int, alt: str) -> tuple[dict | None, dict, list]:
    dp = FakeDataProxy()
    raw = make_allele(start, end, alt)
    events, derived = _trace_normalization(dp, raw, _RefWindow(dp, "ga4gh:SQ.FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE"))
    normalized = normalize(make_allele(start, end, alt), dp)
    return derived, _summary(normalized), events


@pytest.mark.parametrize(
    ("start", "end", "alt", "case"),
    [
        (18, 19, "T", "substitution A>T"),
        (7, 9, "", "deletion AG inside AGAGAG repeat"),
        (9, 9, "AG", "insertion AG inside AGAGAG repeat"),
        (16, 16, "AA", "insertion with no repeat context"),
        (7, 9, "AG", "identity (asserted state equals reference)"),
        (5, 13, "CCAGAGAG", "identity over the whole repeat"),
        (14, 19, "CGGGA", "reference-agreement long"),
        (25, 37, "", "deletion of ACGT repeat copies"),
        (2, 6, "TTC", "deletion with common prefix+suffix to trim"),
    ],
)
def test_derivation_matches_library(start, end, alt, case):
    derived, actual, events = derive(start, end, alt)
    assert derived is not None, case
    assert derived == actual, f"{case}: derived={derived} actual={actual}"
    assert events, case


def test_roll_frames_recorded_for_repeat_deletion():
    _, _, events = derive(7, 9, "")
    steps = [e["step"] for e in events]
    assert "left_roll" in steps
    assert "right_roll" in steps
    # every roll frame carries a ruler for the sequence view
    rolls = [e for e in events if e["step"].endswith("_roll")]
    assert all(e["ruler"] is not None for e in rolls if "skip" not in e["id"])


def test_digest_trace_matches_identify():
    dp = FakeDataProxy()
    allele = normalize(make_allele(7, 9, ""), dp)
    allele.id = ga4gh_identify(allele)
    allele.location.id = ga4gh_identify(allele.location)

    events, ok = _trace_digest(allele)
    assert ok
    final = [e for e in events if e["id"] == "D4"][0]
    assert final["after"]["id"] == allele.id
    # level-3 payloads carry the verbatim bytes and hex
    serialize_events = [e for e in events if e["step"] == "serialize"]
    assert all(e["data"]["serialized"].startswith("{") for e in serialize_events)
