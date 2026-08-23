"""Detect which variant representation a user pasted.

Order is by syntactic distinctiveness so we do not mis-label HGVS as SPDI
(both use colons) or gnomAD as Beacon.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

# SPDI: Sequence : Position : Deleted : Inserted  (deleted/inserted may be empty)
_SPDI_RE = re.compile(
    r"^(?P<ac>[^:\s]+):(?P<pos>\d+):(?P<deleted>[A-Za-z0-9]*):(?P<inserted>[A-Za-z0-9]*)$"
)
_GNOMAD_RE = re.compile(
    r"^(?P<chrom>[A-Za-z0-9_.]+)-(?P<pos>\d+)-"
    r"(?P<ref>[ACGTURYKMSWBDHVN]+)-(?P<alt>[ACGTURYKMSWBDHVN]+)$",
    re.IGNORECASE,
)
# HGVS: accession : [gcnpmr]. remainder   (optional gene in parens)
_HGVS_RE = re.compile(
    r"^(?P<ac>[A-Za-z][A-Za-z0-9_.]+)(?:\([^)]+\))?:(?P<kind>[gcnpmr])\.(?P<rest>.+)$"
)
_VRS_ID_RE = re.compile(r"^ga4gh:(?P<prefix>VA|SL|SQ|CC|CX|CN)\.[A-Za-z0-9_-]+$")
_CLINVAR_RE = re.compile(r"^(?:(?:VCV|RCV|SCV)0*)?(\d{4,})$", re.IGNORECASE)
_RSID_RE = re.compile(r"^rs\d+$", re.IGNORECASE)
_CA_RE = re.compile(r"^CA\d+$", re.IGNORECASE)

SUPPORTED_TRANSLATE = ("hgvs", "spdi", "gnomad", "vrs")
SUPPORTED_DETECT = (
    *SUPPORTED_TRANSLATE,
    "vrs_id",
    "clinvar",
    "rsid",
    "clingen_ca",
)


@dataclass(frozen=True)
class Detection:
    fmt: str
    note: str
    parsed: dict | None = None


class UnknownFormatError(ValueError):
    """Input did not match any representation we know."""


def detect(raw: str) -> Detection:
    """Return the most specific format for `raw`. Raises UnknownFormatError."""
    text = raw.strip()
    if not text:
        raise UnknownFormatError("Empty input.")

    if text.startswith("{") or text.startswith("["):
        try:
            obj = json.loads(text)
        except json.JSONDecodeError as exc:
            raise UnknownFormatError(f"Looks like JSON but failed to parse: {exc}") from exc
        if isinstance(obj, dict) and obj.get("type"):
            return Detection(
                "vrs",
                f"VRS JSON object (type={obj['type']})",
                parsed=obj,
            )
        raise UnknownFormatError("JSON parsed, but it is not a VRS object (missing 'type').")

    if _VRS_ID_RE.match(text):
        return Detection(
            "vrs_id",
            "VRS computed identifier — lookup is not implemented yet.",
            parsed={"id": text},
        )

    m = _SPDI_RE.match(text)
    if m:
        return Detection("spdi", "SPDI (Sequence : Position : Deletion : Insertion)", m.groupdict())

    m = _GNOMAD_RE.match(text)
    if m:
        return Detection("gnomad", "gnomAD / VCF-style chrom-pos-ref-alt", m.groupdict())

    m = _HGVS_RE.match(text)
    if m:
        kind = m.group("kind")
        kind_name = {
            "g": "genomic",
            "c": "coding / transcript",
            "n": "non-coding transcript",
            "p": "protein",
            "m": "mitochondrial",
            "r": "RNA",
        }[kind]
        rest = m.group("rest")
        extra = ""
        if re.search(r"[+-]\d+", rest) and kind in {"c", "n", "r"}:
            extra = (
                " Intronic / offset coordinates (e.g. c.1096-1G>C) need VRS 2.1 "
                "RelativeAllele — vrs-python may reject this."
            )
        if re.search(r"\[[0-9]+\]", rest):
            extra += (
                " HGVS repeat notation ([N]) is a known vrs-python gap "
                "(ga4gh/vrs-python#582)."
            )
        return Detection(
            "hgvs",
            f"HGVS {kind_name} ({m.group('ac')}:{kind}.)" + extra,
            m.groupdict(),
        )

    if _RSID_RE.match(text):
        return Detection("rsid", "dbSNP rsID — registry resolve is not implemented yet.", {"rsid": text})
    if _CA_RE.match(text):
        return Detection(
            "clingen_ca",
            "ClinGen Allele Registry ID — registry resolve is not implemented yet.",
            {"ca": text},
        )
    if _CLINVAR_RE.match(text) or text.upper().startswith(("VCV", "RCV", "SCV")):
        return Detection(
            "clinvar",
            "ClinVar identifier — registry resolve is not implemented yet.",
            {"clinvar": text},
        )

    raise UnknownFormatError(
        "Could not detect a variant representation.\n"
        "Supported today: HGVS, SPDI, gnomAD/VCF (chrom-pos-ref-alt), VRS JSON.\n"
        "Detected later: ClinVar / rsID / ClinGen CA, VRS IDs.\n"
        f"Examples:  NM_007294.4:c.68_69del\n"
        f"           NC_000017.11:43124026:AG:\n"
        f"           17-43124027-CAG-C"
    )
