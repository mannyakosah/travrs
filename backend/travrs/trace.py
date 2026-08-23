"""Re-derive the VRS 2.0 normalization + digest pipeline as visible steps.

Correctness rule: we never *replace* ga4gh.vrs — we re-derive intermediate
states around it and assert our final state equals the library's output.
If the derivation ever disagrees, `trace_verified` is False and the UI must
show the library's answer with a warning.

Event shape (consumed by the frontend trace panel):

    {
      "id": "C4.2", "group": "normalize", "step": "left_roll",
      "iteration": 2, "title": "...", "note": "...",
      "before": {...}, "after": {...},
      "ruler": {"window": "...", "window_start": int, "start": int, "end": int},
      "refs": [{"kind": "spec"|"code"|"paper", "label": "...", "url": "..."}],
      "data": {...}   # level-3 extras (bytes, hex digests)
    }
"""

from __future__ import annotations

import base64
import hashlib
import itertools
from importlib.metadata import PackageNotFoundError, version
from typing import Any

from travrs.detect import Detection

# vrs-python AlleleTranslator default for including RLE literal sequence
_RLE_SEQ_LIMIT = 50
_ROLL_LIMIT = 1000
_ROLL_FRAME_HEAD = 10
_ROLL_FRAME_TAIL = 4
_RULER_PAD = 12

_SPEC_NORM = "https://vrs.ga4gh.org/en/stable/conventions/normalization.html#allele-normalization"
_SPEC_CI = "https://vrs.ga4gh.org/en/stable/conventions/computed_identifiers.html"
_SPEC_DATA = "https://vrs.ga4gh.org/en/stable/conventions/required_data.html"
_PAPER = "https://doi.org/10.1016/j.xgen.2021.100027"


def _vrs_python_version() -> str:
    try:
        return version("ga4gh.vrs")
    except PackageNotFoundError:
        return "main"


def _code_url(path: str) -> str:
    return f"https://github.com/ga4gh/vrs-python/blob/{_vrs_python_version()}/src/ga4gh/{path}"


def _refs(*pairs: tuple[str, str, str]) -> list[dict]:
    return [{"kind": k, "label": label, "url": url} for k, label, url in pairs]


_REFS_NORM = _refs(
    ("spec", "normalization", _SPEC_NORM),
    ("code", "vrs/normalize.py", _code_url("vrs/normalize.py")),
    ("paper", "Wagner 2021 (STAR Methods)", _PAPER),
)
_REFS_DIGEST = _refs(
    ("spec", "computed identifiers", _SPEC_CI),
    ("code", "core/identifiers.py", _code_url("core/identifiers.py")),
    ("paper", "Wagner 2021 (STAR Methods)", _PAPER),
)
_REFS_SEQ = _refs(
    ("spec", "required external data", _SPEC_DATA),
    ("code", "vrs/dataproxy.py", _code_url("vrs/dataproxy.py")),
)


def _ev(
    id: str,
    group: str,
    step: str,
    title: str,
    *,
    note: str = "",
    before: dict | None = None,
    after: dict | None = None,
    ruler: dict | None = None,
    refs: list[dict] | None = None,
    iteration: int | None = None,
    data: dict | None = None,
) -> dict:
    return {
        "id": id,
        "group": group,
        "step": step,
        "iteration": iteration,
        "title": title,
        "note": note,
        "before": before,
        "after": after,
        "ruler": ruler,
        "refs": refs or [],
        "data": data,
    }


class _RefWindow:
    """Cached, extendable slice of one reference sequence."""

    def __init__(self, dp: Any, alias: str) -> None:
        self.dp = dp
        self.alias = alias
        self.buf = ""
        self.buf_start = 0

    def ensure(self, lo: int, hi: int) -> None:
        lo = max(0, lo)
        if self.buf and lo >= self.buf_start and hi <= self.buf_start + len(self.buf):
            return
        new_lo = min(lo, self.buf_start) if self.buf else lo
        new_hi = max(hi, self.buf_start + len(self.buf)) if self.buf else hi
        self.buf = self.dp.get_sequence(self.alias, new_lo, new_hi)
        self.buf_start = new_lo

    def get(self, lo: int, hi: int) -> str:
        if hi <= lo:
            return ""
        self.ensure(lo - 1, hi + 1)
        a = lo - self.buf_start
        b = hi - self.buf_start
        if a < 0 or b > len(self.buf):
            return ""
        return self.buf[a:b]

    def base(self, i: int) -> str:
        """Single base at inter-residue [i, i+1), or '' past either end."""
        if i < 0:
            return ""
        return self.get(i, i + 1)


def _as_int(value: Any) -> int | None:
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


def _seq_str(seq: Any) -> str:
    if seq is None:
        return ""
    return str(getattr(seq, "root", seq))


def _refget(allele: Any) -> str | None:
    seqref = getattr(allele.location, "sequenceReference", None)
    acc = getattr(seqref, "refgetAccession", None)
    return acc


def _summary(allele: Any) -> dict:
    """Comparable summary of interval + state (ids excluded)."""
    st = allele.state
    out: dict[str, Any] = {
        "start": _as_int(allele.location.start),
        "end": _as_int(allele.location.end),
        "state_type": st.type,
    }
    seq = getattr(st, "sequence", None)
    if seq is not None:
        out["sequence"] = _seq_str(seq)
    if st.type == "ReferenceLengthExpression":
        out["length"] = st.length
        out["repeatSubunitLength"] = st.repeatSubunitLength
    return out


def _ruler(win: _RefWindow, start: int, end: int, pad: int = _RULER_PAD) -> dict:
    lo = max(0, start - pad)
    hi = end + pad
    return {
        "window": win.get(lo, hi),
        "window_start": lo,
        "start": start,
        "end": end,
    }


def _raw_allele(tr: Any, raw: str, detection: Detection) -> Any:
    """The pre-normalization Allele, straight from the translator."""
    if detection.fmt == "vrs":
        return tr.translate_from(detection.parsed, "vrs")
    return tr.translate_from(raw, detection.fmt, do_normalize=False)


# ---------------------------------------------------------------- group A + B


def _intro_events(raw_allele: Any, detection: Detection, win: _RefWindow) -> list[dict]:
    parsed = detection.parsed or {}
    input_label = parsed.get("ac") or parsed.get("chrom") or "input sequence"
    acc = _refget(raw_allele) or "?"
    start = _as_int(raw_allele.location.start)
    end = _as_int(raw_allele.location.end)

    events = [
        _ev(
            "A1",
            "resolve",
            "sequence_digest",
            "Accession → sequence digest",
            note=(
                f"{input_label!r} resolves (via SeqRepo) to ga4gh:{acc} — a digest of the "
                "sequence itself. The human label never enters the hash, which is why "
                "RefSeq and Ensembl spellings of the same sequence give the same VRS ID."
            ),
            before={"accession": input_label},
            after={"refgetAccession": acc},
            refs=_REFS_SEQ,
        )
    ]
    if detection.fmt == "hgvs" and (parsed.get("kind") in {"c", "n", "r"}):
        events.append(
            _ev(
                "A2",
                "resolve",
                "transcript_projection",
                "Transcript coordinates via UTA",
                note=(
                    f"'{parsed.get('kind')}.' coordinates live in transcript space; the "
                    "hgvs package + UTA map them onto the sequence before VRS sees them."
                ),
                refs=_REFS_SEQ,
            )
        )

    if start is not None and end is not None:
        note = (
            f"The residue-numbered input becomes the inter-residue interval "
            f"[{start}, {end}) — two cuts between bases. One interpretation for every "
            "operation type; this is why VRS insists it is not merely '0-based'."
        )
        if detection.fmt == "spdi":
            note = (
                f"SPDI positions are already 0-based interbase; VRS states the full "
                f"interval [{start}, {end}) explicitly."
            )
        events.append(
            _ev(
                "B1",
                "coordinates",
                "inter_residue",
                "Inter-residue interval",
                note=note,
                after={"start": start, "end": end},
                ruler=_ruler(win, start, end),
                refs=_refs(("spec", "normalization", _SPEC_NORM), ("paper", "Wagner 2021 §inter-residue", _PAPER)),
            )
        )
    return events


# ---------------------------------------------------------------- group C


def _rle_state(length: int, subunit: int, alt: str) -> dict:
    out: dict[str, Any] = {
        "state_type": "ReferenceLengthExpression",
        "length": length,
        "repeatSubunitLength": subunit,
    }
    if length <= _RLE_SEQ_LIMIT:
        out["sequence"] = alt
    return out


def _roll_events(
    events: list[dict],
    win: _RefWindow,
    seq: str,
    anchor: int,
    direction: str,
    ruler_span: tuple[int, int],
) -> int:
    """Record left/right roll frames. Returns the roll bound."""
    step = f"{direction}_roll"
    prefix = "C4" if direction == "left" else "C5"
    bound = anchor
    rolled = seq
    frames: list[dict] = []
    iteration = 0
    while iteration < _ROLL_LIMIT:
        if direction == "left":
            neighbor = win.base(bound - 1)
            match = neighbor != "" and neighbor == rolled[-1]
        else:
            neighbor = win.base(bound)
            match = neighbor != "" and neighbor == rolled[0]
        if not match:
            frames.append(
                _ev(
                    f"{prefix}.{iteration + 1}",
                    "normalize",
                    step,
                    f"{direction.capitalize()} roll — stop",
                    iteration=iteration + 1,
                    note=(
                        f"base {neighbor or '∅'!r} does not continue the repeat "
                        f"({rolled[-1] if direction == 'left' else rolled[0]!r} needed); bound stays at {bound}"
                    ),
                    before={"bound": bound, "seq": rolled},
                    after={"bound": bound, "seq": rolled},
                    ruler=_ruler(win, *ruler_span),
                    refs=_REFS_NORM,
                )
            )
            break
        iteration += 1
        if direction == "left":
            new_bound = bound - 1
            new_rolled = rolled[-1] + rolled[:-1]
            note = f"ref[{new_bound}]={neighbor!r} == last base of {rolled!r} → extend left, permute to {new_rolled!r}"
        else:
            new_bound = bound + 1
            new_rolled = rolled[1:] + rolled[0]
            note = f"ref[{bound}]={neighbor!r} == first base of {rolled!r} → extend right, permute to {new_rolled!r}"
        frames.append(
            _ev(
                f"{prefix}.{iteration}",
                "normalize",
                step,
                f"{direction.capitalize()} roll — match, permute",
                iteration=iteration,
                note=note,
                before={"bound": bound, "seq": rolled},
                after={"bound": new_bound, "seq": new_rolled},
                ruler=_ruler(win, *ruler_span),
                refs=_REFS_NORM,
            )
        )
        bound, rolled = new_bound, new_rolled

    if len(frames) > _ROLL_FRAME_HEAD + _ROLL_FRAME_TAIL + 1:
        skipped = len(frames) - _ROLL_FRAME_HEAD - _ROLL_FRAME_TAIL
        frames = (
            frames[:_ROLL_FRAME_HEAD]
            + [
                _ev(
                    f"{prefix}.skip",
                    "normalize",
                    step,
                    f"… {skipped} more identical roll steps …",
                    note="collapsed for size; the repeat continues",
                    refs=_REFS_NORM,
                )
            ]
            + frames[-_ROLL_FRAME_TAIL:]
        )
    events.extend(frames)
    return bound


def _trace_normalization(
    dp: Any, raw_allele: Any, win: _RefWindow
) -> tuple[list[dict], dict | None]:
    """Mirror ga4gh.vrs.normalize._normalize_allele, recording every state.

    Returns (events, derived_summary). derived_summary is None when the
    library is expected to pass the object through unchanged.
    """
    events: list[dict] = []

    state_type = raw_allele.state.type
    if state_type != "LiteralSequenceExpression":
        events.append(
            _ev(
                "C0",
                "normalize",
                "passthrough",
                f"State is {state_type} — no normalization",
                note=(
                    "The VOCA algorithm applies to LiteralSequenceExpression states; "
                    "other states are returned unchanged by the library."
                ),
                refs=_REFS_NORM,
            )
        )
        return events, None

    start0 = _as_int(raw_allele.location.start)
    end0 = _as_int(raw_allele.location.end)
    if start0 is None or end0 is None:
        events.append(
            _ev(
                "C0",
                "normalize",
                "passthrough",
                "Range coordinates — trace not derived",
                note="start/end are not plain integers; showing the library result only.",
                refs=_REFS_NORM,
            )
        )
        return events, None

    alt0 = _seq_str(raw_allele.state.sequence)
    win.ensure(max(0, start0 - 64), end0 + 64)
    ref0 = win.get(start0, end0)

    events.append(
        _ev(
            "C0",
            "normalize",
            "operands",
            "Operands",
            note=(
                f"reference at [{start0}, {end0}) is {ref0!r}; the asserted state is {alt0!r}. "
                "Normalization compares exactly these two strings."
            ),
            before={"start": start0, "end": end0, "ref": ref0, "alt": alt0},
            ruler=_ruler(win, start0, end0),
            refs=_REFS_NORM,
        )
    )

    # C1: trim common suffix
    ref, alt, start, end = ref0, alt0, start0, end0
    n_suffix = 0
    while ref and alt and ref[-1] == alt[-1]:
        ref, alt = ref[:-1], alt[:-1]
        end -= 1
        n_suffix += 1
    events.append(
        _ev(
            "C1",
            "normalize",
            "trim_suffix",
            "Trim common suffix",
            note=(
                f"{n_suffix} shared trailing base(s) removed; end {end0} → {end}"
                if n_suffix
                else "no shared trailing bases"
            ),
            before={"start": start0, "end": end0, "ref": ref0, "alt": alt0},
            after={"start": start, "end": end, "ref": ref, "alt": alt},
            ruler=_ruler(win, start, max(end, start)),
            refs=_REFS_NORM,
        )
    )

    # C2: trim common prefix
    ref_b, alt_b, start_b = ref, alt, start
    n_prefix = 0
    while ref and alt and ref[0] == alt[0]:
        ref, alt = ref[1:], alt[1:]
        start += 1
        n_prefix += 1
    events.append(
        _ev(
            "C2",
            "normalize",
            "trim_prefix",
            "Trim common prefix",
            note=(
                f"{n_prefix} shared leading base(s) removed; start {start_b} → {start}"
                if n_prefix
                else "no shared leading bases"
            ),
            before={"start": start_b, "end": end, "ref": ref_b, "alt": alt_b},
            after={"start": start, "end": end, "ref": ref, "alt": alt},
            ruler=_ruler(win, start, max(end, start)),
            refs=_REFS_NORM,
        )
    )

    # C3: classify
    if ref0 == alt0:
        # Identity: original interval, RLE(length=repeatSubunitLength=len)
        seed = len(alt0)
        derived = {"start": start0, "end": end0, **_rle_state(seed, seed, alt0)}
        events.append(
            _ev(
                "C3",
                "normalize",
                "classify",
                "Classify: reference-agreement Allele",
                note=(
                    "Asserted state equals the reference. VRS 2.0 keeps the original "
                    "interval and encodes the state as a ReferenceLengthExpression — "
                    "'this region, derived from the reference, at its own length'."
                ),
                after=derived,
                ruler=_ruler(win, start0, end0),
                refs=_REFS_NORM,
            )
        )
        return events, derived

    if ref and alt:
        derived = {
            "start": start,
            "end": end,
            "state_type": "LiteralSequenceExpression",
            "sequence": alt,
        }
        events.append(
            _ev(
                "C3",
                "normalize",
                "classify",
                "Classify: substitution — done",
                note=(
                    f"Both sequences non-empty after trimming ({ref!r} → {alt!r}). "
                    "Substitutions have no positional ambiguity; normalization stops here."
                ),
                after=derived,
                ruler=_ruler(win, start, end),
                refs=_REFS_NORM,
            )
        )
        return events, derived

    is_deletion = bool(ref)
    seed = ref or alt
    seed_len = len(seed)
    events.append(
        _ev(
            "C3",
            "normalize",
            "classify",
            f"Classify: {'deletion' if is_deletion else 'insertion'} — roll for ambiguity",
            note=(
                f"One side is empty; the {'deleted' if is_deletion else 'inserted'} "
                f"sequence {seed!r} may sit anywhere in a repeat. Roll to find the bounds."
            ),
            after={"start": start, "end": end, "seed": seed},
            ruler=_ruler(win, start, max(end, start)),
            refs=_REFS_NORM,
        )
    )

    # C4/C5: rolls. Left roll anchors at start (rotating right); right roll
    # anchors at end (rotating left).
    ruler_span = (start, max(end, start))
    left_bound = _roll_events(events, win, seed, start, "left", ruler_span)
    right_bound = _roll_events(events, win, seed, end, "right", ruler_span)

    # C6: expand across the ambiguity region
    ext_ref = win.get(left_bound, right_bound)
    mid = "" if is_deletion else alt
    ext_alt = win.get(left_bound, start) + mid + win.get(end, right_bound)
    if left_bound == start and right_bound == end and not is_deletion:
        # pure insertion, no ambiguity (ext_ref empty)
        ext_ref = ""
        ext_alt = alt
    events.append(
        _ev(
            "C6",
            "normalize",
            "expand",
            "Expand to the full region of ambiguity",
            note=(
                f"Interval widens to [{left_bound}, {right_bound}). VRS refuses to pick an "
                "arbitrary position inside the repeat (HGVS shifts 3', VCF shifts left) — "
                "it represents the change over the whole region."
            ),
            before={"start": start, "end": end},
            after={"start": left_bound, "end": right_bound, "ref": ext_ref, "alt": ext_alt},
            ruler=_ruler(win, left_bound, right_bound),
            refs=_REFS_NORM,
        )
    )

    # C7: encode state (VRS 2.0 RLE rules)
    if not ext_ref:
        derived = {
            "start": left_bound,
            "end": right_bound,
            "state_type": "LiteralSequenceExpression",
            "sequence": ext_alt,
        }
        note = "Unambiguous insertion (no reference in the region) — state stays literal."
    elif is_deletion:
        derived = {"start": left_bound, "end": right_bound, **_rle_state(len(ext_alt), seed_len, ext_alt)}
        note = (
            f"Deletions are reference-derived by definition: {ext_ref!r} → "
            f"⟨length {len(ext_alt)}, repeat subunit {seed_len}⟩."
        )
    else:
        # ambiguous insertion: greatest factor d of seed length such that the
        # extended alt is a circular expansion of the reference tail
        derived = None
        note = ""
        for d in _factors_desc(seed_len):
            if d > len(ext_ref):
                continue
            if _is_valid_cycle(len(ext_ref) - d, ext_ref, ext_alt):
                derived = {"start": left_bound, "end": right_bound, **_rle_state(len(ext_alt), d, ext_alt)}
                note = (
                    f"Inserted repeat is derivable from the reference (subunit length {d}) "
                    f"→ ReferenceLengthExpression ⟨length {len(ext_alt)}, subunit {d}⟩."
                )
                break
        if derived is None:
            if len(ext_alt) == len(ext_ref):
                derived = {
                    "start": left_bound,
                    "end": right_bound,
                    "state_type": "LiteralSequenceExpression",
                    "sequence": ext_alt,
                }
                note = "Extended sequences have equal length — literal state."
            else:
                derived = {
                    "start": left_bound,
                    "end": right_bound,
                    "state_type": "LiteralSequenceExpression",
                    "sequence": ext_alt,
                }
                note = "Insertion is not reference-derived — state stays literal."
    events.append(
        _ev(
            "C7",
            "normalize",
            "encode_state",
            "Encode state (VRS 2.0)",
            note=note,
            after=derived,
            ruler=_ruler(win, left_bound, right_bound),
            refs=_REFS_NORM,
        )
    )
    return events, derived


def _factors_desc(n: int):
    lower = []
    i = 1
    while i * i <= n:
        if n % i == 0:
            yield n // i
            if n // i != i:
                lower.append(i)
        i += 1
    yield from reversed(lower)


def _is_valid_cycle(template_start: int, template: str, target: str) -> bool:
    cycle = itertools.cycle(template[template_start:])
    return all(char == next(cycle) for char in target[len(template):])


# ---------------------------------------------------------------- group D


def _b64url(digest24: bytes) -> str:
    return base64.urlsafe_b64encode(digest24).decode("ascii")


def _digest_events(obj: Any, kind: str, id_prefix: str, title_noun: str) -> tuple[list[dict], str]:
    """Serialize + hash events for one identifiable object. Returns (events, digest)."""
    from ga4gh.core import ga4gh_serialize

    serialized = ga4gh_serialize(obj)
    sha = hashlib.sha512(serialized).digest()
    truncated = sha[:24]
    digest = _b64url(truncated)

    events = [
        _ev(
            f"{id_prefix}a",
            "digest",
            "serialize",
            f"Digest-serialize the {title_noun}",
            note=(
                "Canonical JSON: nested identifiable objects replaced by their digests, "
                "keys sorted, UTF-8, no whitespace. Non-inherent fields (id, label, …) "
                "are excluded — only digest-relevant content survives."
            ),
            data={"serialized": serialized.decode("utf-8")},
            refs=_REFS_DIGEST,
        ),
        _ev(
            f"{id_prefix}b",
            "digest",
            "hash",
            f"SHA-512, truncate, base64url ({title_noun})",
            note=f"512-bit hash cut to 24 bytes, base64url → {kind}.{digest}",
            data={
                "sha512_hex": sha.hex(),
                "truncated_hex": truncated.hex(),
                "base64url": digest,
            },
            refs=_REFS_DIGEST,
        ),
    ]
    return events, digest


def _trace_digest(allele: Any) -> tuple[list[dict], bool]:
    events: list[dict] = []
    loc_events, loc_digest = _digest_events(allele.location, "SL", "D1", "SequenceLocation")
    events.extend(loc_events)
    allele_events, va_digest = _digest_events(allele, "VA", "D3", "Allele")
    # point out the recursion in the allele serialization
    allele_events[0]["note"] += (
        f" Note the location appears as its digest ({loc_digest}) — the recursion "
        "bottoms out at the sequence digest (SQ)."
    )
    events.extend(allele_events)
    events.append(
        _ev(
            "D4",
            "digest",
            "prefix",
            "Assemble the identifier",
            note="namespace + type prefix + digest",
            after={"id": f"ga4gh:VA.{va_digest}"},
            data={"namespace": "ga4gh", "type_prefix": "VA", "digest": va_digest},
            refs=_REFS_DIGEST,
        )
    )
    ok = bool(allele.id) and str(allele.id).endswith(va_digest)
    return events, ok


# ---------------------------------------------------------------- entry point


def build_trace(
    dp: Any, tr: Any, raw: str, detection: Detection, normalized_allele: Any
) -> tuple[list[dict], bool]:
    """Full trace for one inspected Allele. Returns (events, verified)."""
    raw_allele = _raw_allele(tr, raw, detection)
    acc = _refget(raw_allele)
    if acc is None:
        return [], False
    win = _RefWindow(dp, f"ga4gh:{acc}")

    events = _intro_events(raw_allele, detection, win)

    norm_events, derived = _trace_normalization(dp, raw_allele, win)
    events.extend(norm_events)

    actual = _summary(normalized_allele)
    if derived is None:
        norm_ok = True  # passthrough: nothing derived, library result shown as-is
    else:
        norm_ok = derived == actual
        events.append(
            _ev(
                "C8",
                "normalize",
                "verify",
                "Verify against ga4gh.vrs.normalize",
                note=(
                    "re-derived state matches the library byte for byte"
                    if norm_ok
                    else "MISMATCH — the library result is authoritative; this trace has a bug worth reporting"
                ),
                before=derived,
                after=actual,
                refs=_REFS_NORM,
            )
        )

    digest_events, digest_ok = _trace_digest(normalized_allele)
    events.extend(digest_events)

    return events, bool(norm_ok and digest_ok)
