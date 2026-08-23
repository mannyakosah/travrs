# traVRS backend

Python package, CLI, and HTTP API. Translation, normalization, and computed
identifiers go through [vrs-python](https://github.com/ga4gh/vrs-python).

Requires **Python 3.12** (vrs-python develops on 3.12; 3.10+ works).

## Install

From this directory:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,web]"
```

If `psycopg2` fails to build: `brew install libpq` (macOS), then retry.

On some machines `python` is aliased to a system interpreter. Prefer
`.venv/bin/python` if imports fail.

## CLI

```bash
python hello_vrs.py

python -m travrs.cli "NM_007294.4:c.68_69del"
python -m travrs.cli --json "NC_000017.11:43124026:AG:"
travrs "7-140753336-A-T"
```

First run talks to public SeqRepo + UTA and can take 10–20 seconds. Each new
CLI process pays that connect cost again. The HTTP API keeps the translator warm.

## HTTP API

```bash
travrs-serve
```

```bash
curl -s http://127.0.0.1:8000/api/inspect \
  -H 'Content-Type: application/json' \
  -d '{"input":"NM_007294.4:c.68_69del"}' | python -m json.tool
```

`POST /api/inspect` accepts `{"input": "...", "format": "hgvs"|"spdi"|"gnomad"|"vrs"}`.
The response shape is in `examples/inspect-response.json`. Interactive docs:
http://127.0.0.1:8000/docs. CORS is open to the Vite ports (`5173`, `4173`).
Successful results are cached under `.cache/travrs`.

## Examples

**Same context → same ID.** Both on transcript `NM_007294.4` produce
`ga4gh:VA.0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD`:

```bash
python -m travrs.cli "NM_007294.4:c.68_69del"     # HGVS coding
python -m travrs.cli "NM_007294.4:178:4:AG"       # SPDI of the same allele
```

**Different context → different ID.** The same BRCA1 founder mutation on GRCh38
chr17 is a different VRS object (`ga4gh:VA.NTCeCp4z3OjbRZnp6I1mONPrRn7i-ugU`).
That is deliberate — VRS is context-precise:

```bash
python -m travrs.cli "NC_000017.11:g.43124027_43124028del"
python -m travrs.cli "NC_000017.11:43124024:4:AC"
```

A substitution (BRAF V600E genomic). HGVS and gnomAD agree on
`ga4gh:VA.Otc5ovrw906Ack087o1fhegB4jDRqCAe`:

```bash
python -m travrs.cli "NC_000007.14:g.140753336A>T"
python -m travrs.cli "7-140753336-A-T"
```

## Data services

Everything below is free and needs no account.

| Service | Role | Environment variable |
|---|---|---|
| [SeqRepo REST](https://services.genomicmedlab.org/seqrepo) | reference bases + accession → `ga4gh:SQ.` digest | `GA4GH_VRS_DATAPROXY_URI` |
| [UTA](https://github.com/biocommons/uta) | transcript ↔ genome projection for `c.` / `p.` HGVS | `UTA_DB_URL` |

Defaults are the public instances. Override either variable to point at a local SeqRepo or UTA.

## Tests

Format detection and API (no network):

```bash
pytest tests/test_detect.py tests/test_api.py
```
