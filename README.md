# traVRS

**traVRS** (pronounced *traverse*) — trace any variant through the verse.

A developer-experience tool for the [GA4GH Variation Representation Specification](https://vrs.ga4gh.org) (VRS, pronounced *verse*). Paste HGVS, SPDI, gnomAD/VCF, or VRS JSON; get a normalized VRS Allele, a globally computed `ga4gh:VA.` identifier, and equivalent representations.

This is **not** a reimplementation of VRS. Translation, normalization, and computed identifiers all go through the official reference library, [vrs-python](https://github.com/ga4gh/vrs-python). traVRS wraps that machinery so a newcomer can see it work in the first 15 minutes.

```
Input        NM_007294.4:c.68_69del          (BRCA1 185delAG)
     ↓  AlleleTranslator + SeqRepo + UTA
VRS Allele   { "type": "Allele", … }
Identifier   ga4gh:VA.…
Equivalents  SPDI / HGVS on the same sequence context
```

No local sequence download. No local Postgres. Public SeqRepo REST + public UTA.

## Install

```bash
git clone https://github.com/mannyakosah/travrs.git
cd travrs
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

If `psycopg2` fails to build: `brew install libpq` (macOS), then retry.

On some machines `python` is aliased to a system interpreter. Prefer `.venv/bin/python` if imports fail.

## Quick start

Smoke-test the official stack (one HGVS string → VRS Allele + computed ID):

```bash
python hello_vrs.py
```

Then explain any supported expression:

```bash
python -m travrs.cli "NM_007294.4:c.68_69del"
python -m travrs.cli --json "NC_000017.11:43124026:AG:"
travrs "7-140753336-A-T"
```

First run talks to public SeqRepo + UTA and can take 10–20 seconds. Each new CLI process pays that connect cost again.

## Examples

**Same context → same ID.** These two are both on transcript `NM_007294.4` and produce
`ga4gh:VA.0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD`:

```bash
python -m travrs.cli "NM_007294.4:c.68_69del"     # HGVS coding
python -m travrs.cli "NM_007294.4:178:4:AG"       # SPDI of the same allele
```

**Different context → different ID.** The same BRCA1 founder mutation *on GRCh38 chr17*
is a different VRS object (`ga4gh:VA.NTCeCp4z3OjbRZnp6I1mONPrRn7i-ugU`). That is
deliberate — VRS is context-precise:

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

Format detection (no network):

```bash
pytest tests/test_detect.py
```
