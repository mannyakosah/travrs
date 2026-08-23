"""Translate any supported representation through official vrs-python.

Correctness rule: we never reimplement normalize / identify / serialize.
Those stay inside ga4gh.vrs. We wrap, record, and explain.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from traverse.detect import Detection, UnknownFormatError, detect
from traverse.env import apply_defaults

Progress = Callable[[str], None]


def _emit(on_progress: Progress | None, message: str) -> None:
    if on_progress is not None:
        on_progress(message)

# Lazy so `python -m traverse.cli --help` does not open SeqRepo.
_translator = None
_dataproxy = None


@dataclass
class Check:
    name: str
    ok: bool
    detail: str


@dataclass
class InspectResult:
    input: str
    detection: Detection
    allele: Any | None = None
    allele_json: dict | None = None
    vrs_id: str | None = None
    location_id: str | None = None
    equivalents: dict[str, list[str]] = field(default_factory=dict)
    checks: list[Check] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    versions: dict[str, str] = field(default_factory=dict)
    reference_at_location: str | None = None

    def to_dict(self) -> dict:
        return {
            "input": self.input,
            "detected_format": self.detection.fmt,
            "detection_note": self.detection.note,
            "id": self.vrs_id,
            "location_id": self.location_id,
            "allele": self.allele_json,
            "equivalents": self.equivalents,
            "checks": [c.__dict__ for c in self.checks],
            "reference_at_location": self.reference_at_location,
            "errors": self.errors,
            "versions": self.versions,
        }


def _versions() -> dict[str, str]:
    from importlib.metadata import PackageNotFoundError, version

    out = {"traverse": "0.1.0"}
    for pkg, key in (("ga4gh.vrs", "vrs_python"), ("ga4gh.core", "ga4gh_core")):
        try:
            out[key] = version(pkg)
        except PackageNotFoundError:
            out[key] = "unknown"
    return out


def get_services(on_progress: Progress | None = None):
    """Create (once) the SeqRepo dataproxy + AlleleTranslator."""
    global _translator, _dataproxy
    if _translator is not None:
        _emit(on_progress, "Reusing SeqRepo + translator connection")
        return _dataproxy, _translator

    apply_defaults()
    from ga4gh.vrs.dataproxy import create_dataproxy
    from ga4gh.vrs.extras.translator import AlleleTranslator

    _emit(on_progress, "Connecting to SeqRepo REST (public sequence service)…")
    _dataproxy = create_dataproxy()
    _emit(on_progress, "SeqRepo connected. Preparing AlleleTranslator…")
    _translator = AlleleTranslator(_dataproxy)
    _emit(on_progress, "Translator ready")
    return _dataproxy, _translator


def _as_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if hasattr(value, "root"):
        try:
            return int(value.root)
        except (TypeError, ValueError):
            return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _state_sequence(allele: Any) -> str | None:
    state = getattr(allele, "state", None)
    if state is None:
        return None
    seq = getattr(state, "sequence", None)
    if seq is None:
        return None
    if hasattr(seq, "root"):
        return str(seq.root)
    return str(seq)


def _refget_accession(allele: Any) -> str | None:
    loc = allele.location
    getter = getattr(loc, "get_refget_accession", None)
    if callable(getter):
        acc = getter()
        if acc:
            return acc if acc.startswith("ga4gh:") or acc.startswith("SQ.") else acc
    seqref = getattr(loc, "sequenceReference", None) or getattr(loc, "sequence_reference", None)
    if seqref is None:
        return None
    acc = getattr(seqref, "refgetAccession", None) or getattr(seqref, "refget_accession", None)
    return acc


def _fetch_ref(dp, allele: Any) -> tuple[str | None, str | None]:
    """Return (sequence, error) for the allele's SequenceLocation."""
    acc = _refget_accession(allele)
    start = _as_int(allele.location.start)
    end = _as_int(allele.location.end)
    if acc is None or start is None or end is None:
        return None, "location is missing accession or integer start/end"
    identifier = acc if ":" in acc else f"ga4gh:{acc}"
    try:
        return dp.get_sequence(identifier, start, end), None
    except Exception as exc:  # noqa: BLE001 — surface any seqrepo failure
        return None, f"{type(exc).__name__}: {exc}"


_HGVS_SUB_RE = re.compile(r"(?P<ref>[ACGTN]+)>(?P<alt>[ACGTN]+)$", re.IGNORECASE)
_HGVS_DELSEQ_RE = re.compile(r"del(?P<ref>[ACGTN]+)$", re.IGNORECASE)
_HGVS_DELINS_RE = re.compile(r"delins(?P<alt>[ACGTN]+)$", re.IGNORECASE)


def _asserted_ref_from_input(detection: Detection, raw: str) -> tuple[str | None, str]:
    """Best-effort asserted reference bases from the *input string*."""
    parsed = detection.parsed or {}
    if detection.fmt == "gnomad":
        return parsed.get("ref", "").upper(), "gnomAD REF field"
    if detection.fmt == "spdi":
        deleted = parsed.get("deleted") or ""
        if deleted.isdigit():
            return None, "SPDI used a deletion *length*, not bases — nothing to compare"
        if deleted:
            return deleted.upper(), "SPDI deleted sequence"
        return "", "SPDI insertion (empty deleted sequence)"
    if detection.fmt == "hgvs":
        rest = parsed.get("rest") or raw.rsplit(".", 1)[-1]
        m = _HGVS_SUB_RE.search(rest)
        if m:
            return m.group("ref").upper(), "HGVS substitution reference"
        m = _HGVS_DELSEQ_RE.search(rest)
        if m:
            return m.group("ref").upper(), "HGVS deleted bases"
    return None, "input does not spell the reference bases"


def _reference_checks(dp, allele: Any, detection: Detection, raw: str) -> tuple[list[Check], str | None]:
    checks: list[Check] = []
    fetched, err = _fetch_ref(dp, allele)
    if err:
        checks.append(Check("reference_fetch", False, err))
        return checks, None

    start = _as_int(allele.location.start)
    end = _as_int(allele.location.end)
    checks.append(
        Check(
            "reference_fetch",
            True,
            f"bases at inter-residue [{start}, {end}) = {fetched!r}",
        )
    )

    asserted, source = _asserted_ref_from_input(detection, raw)
    if asserted is None:
        detail = f"skipped ({source})"
        if detection.fmt == "hgvs":
            detail += (
                ". vrs-python's HGVS path does not always reject a wrong "
                "reference allele (ga4gh/vrs-python#364)"
            )
        checks.append(Check("asserted_reference", True, detail))
        return checks, fetched

    # After full-justification the VRS interval may be *larger* than the
    # asserted ref (repeat-region indels). Treat "asserted is a substring of
    # fetched" as agreement; only fail on a hard mismatch of equal length.
    if asserted == fetched:
        ok, detail = True, f"{source} {asserted!r} matches location sequence"
    elif asserted and asserted in (fetched or ""):
        ok, detail = (
            True,
            f"{source} {asserted!r} is contained in the fully-justified "
            f"location {fetched!r} (expected after VRS normalization)",
        )
    elif len(asserted) == len(fetched or "") and asserted != fetched:
        ok, detail = (
            False,
            f"{source} asserted {asserted!r} but sequence is {fetched!r} "
            f"(this is the ga4gh/vrs-python#364 class of error)",
        )
    else:
        ok, detail = (
            True,
            f"{source} {asserted!r} vs location {fetched!r} — lengths differ "
            "after normalization; not treated as a mismatch",
        )
    checks.append(Check("asserted_reference", ok, detail))
    return checks, fetched


def _equivalents(
    tr, allele: Any, on_progress: Progress | None = None
) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for fmt in ("hgvs", "spdi"):
        _emit(on_progress, f"Translating VRS → {fmt.upper()}…")
        try:
            value = tr.translate_to(allele, fmt)
        except Exception as exc:  # noqa: BLE001
            out[fmt] = [f"(unavailable: {type(exc).__name__}: {exc})"]
            continue
        if isinstance(value, list):
            out[fmt] = [str(v) for v in value]
        else:
            out[fmt] = [str(value)]
    return out


_TRANSLATE_HINTS = {
    "hgvs": "Translating HGVS → VRS (SeqRepo + UTA; first call is slow)…",
    "spdi": "Translating SPDI → VRS (SeqRepo)…",
    "gnomad": "Translating gnomAD/VCF → VRS (SeqRepo)…",
    "vrs": "Loading VRS JSON…",
}


def inspect(
    raw: str,
    fmt: str | None = None,
    on_progress: Progress | None = None,
) -> InspectResult:
    """Detect → translate_from (official) → checks → translate_to."""
    apply_defaults()
    result = InspectResult(
        input=raw.strip(),
        detection=Detection("unknown", ""),
        versions=_versions(),
    )
    _emit(on_progress, "Detecting format…")
    try:
        result.detection = detect(raw) if fmt is None else Detection(fmt, f"forced format={fmt}")
    except UnknownFormatError as exc:
        result.errors.append(str(exc))
        return result

    if result.detection.fmt not in {"hgvs", "spdi", "gnomad", "vrs"}:
        result.errors.append(
            f"Detected {result.detection.fmt}: {result.detection.note} "
            "Translation for this format is not implemented yet."
        )
        return result

    dp, tr = get_services(on_progress=on_progress)

    _emit(on_progress, _TRANSLATE_HINTS.get(result.detection.fmt, "Translating to VRS…"))
    try:
        if result.detection.fmt == "vrs":
            payload = result.detection.parsed
            allele = tr.translate_from(payload, "vrs")  # type: ignore[arg-type]
        else:
            allele = tr.translate_from(result.input, result.detection.fmt)
    except Exception as exc:  # noqa: BLE001
        result.errors.append(f"vrs-python translate_from failed: {type(exc).__name__}: {exc}")
        result.checks.append(Check("translate", False, str(exc)))
        return result

    result.allele = allele
    result.checks.append(Check("translate", True, f"AlleleTranslator.translate_from(fmt={result.detection.fmt!r})"))
    result.vrs_id = getattr(allele, "id", None)
    result.location_id = getattr(allele.location, "id", None)
    result.allele_json = json.loads(
        allele.model_dump_json(exclude_none=True, by_alias=True)
    )
    if result.vrs_id:
        result.checks.append(Check("computed_id", True, result.vrs_id))
    else:
        result.checks.append(Check("computed_id", False, "translator did not attach an id"))

    _emit(on_progress, "Fetching reference bases from SeqRepo…")
    ref_checks, fetched = _reference_checks(dp, allele, result.detection, result.input)
    result.checks.extend(ref_checks)
    result.reference_at_location = fetched
    result.equivalents = _equivalents(tr, allele, on_progress=on_progress)
    _emit(on_progress, "Done")
    return result
