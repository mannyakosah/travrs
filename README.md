# TraVerse

**trace any variant through the verse**

A developer-experience tool for the [GA4GH Variation Representation Specification](https://vrs.ga4gh.org) (VRS, pronounced *verse*). Paste HGVS, SPDI, gnomAD/VCF, or VRS JSON; get a normalized VRS Allele, a globally computed `ga4gh:VA.` identifier, equivalent representations, and (soon) the actual transformation trace.

This is **not** a reimplementation of VRS. Translation, normalization, and computed identifiers all go through the official reference library, [vrs-python](https://github.com/ga4gh/vrs-python). TraVerse wraps that machinery so a newcomer can see it work in the first 15 minutes.

```
Input        NM_007294.4:c.68_69del          (BRCA1 185delAG)
     ↓  AlleleTranslator + SeqRepo + UTA
VRS Allele   { "type": "Allele", … }
Identifier   ga4gh:VA.…
Equivalents  SPDI / HGVS on the same sequence context
```

No local sequence download. No local Postgres. Public SeqRepo REST + public UTA.

---

## Step 0 — prove the stack works (~2 minutes after install)

```bash
cd ~/Code/traverse
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

python hello_vrs.py
```

You should see a VRS Allele JSON, a `ga4gh:VA.` ID, and an SPDI string. If `psycopg2` fails to build: `brew install libpq` (macOS) then retry.

## Step 1 — `vrs-explain`

```bash
source .venv/bin/activate
python -m traverse.cli "NM_007294.4:c.68_69del"
python -m traverse.cli --json "NC_000017.11:43124026:AG:"
python -m traverse.cli "17-43124027-CAG-C"
```

After `pip install -e .` the same command is `vrs-explain`.

**Same context → same ID.** These two are both on transcript `NM_007294.4` and produce
`ga4gh:VA.0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD`:

```bash
python -m traverse.cli "NM_007294.4:c.68_69del"     # HGVS coding
python -m traverse.cli "NM_007294.4:178:4:AG"       # SPDI of the same allele
```

**Different context → different ID.** The same BRCA1 founder mutation *on GRCh38 chr17*
is a different VRS object (`ga4gh:VA.NTCeCp4z3OjbRZnp6I1mONPrRn7i-ugU`). That is
deliberate — VRS is context-precise:

```bash
python -m traverse.cli "NC_000017.11:g.43124027_43124028del"
python -m traverse.cli "NC_000017.11:43124024:4:AC"
```

A substitution (BRAF V600E genomic). HGVS and gnomAD agree on
`ga4gh:VA.Otc5ovrw906Ack087o1fhegB4jDRqCAe`:

```bash
python -m traverse.cli "NC_000007.14:g.140753336A>T"
python -m traverse.cli "7-140753336-A-T"
```

First run talks to public SeqRepo + UTA and can take 10–20 seconds. Later runs in the
same process are faster; each new CLI invocation pays the connect cost again (Step 2's
API will keep the translator warm).

---

## What you need (all free, no accounts)

| Service | Role | Default |
|---|---|---|
| [SeqRepo REST](https://services.genomicmedlab.org/seqrepo) | reference bases + accession → `ga4gh:SQ.` digest | `GA4GH_VRS_DATAPROXY_URI` |
| [UTA](https://github.com/biocommons/uta) | transcript ↔ genome projection for `c.` / `p.` HGVS | `UTA_DB_URL` |

Override either with an environment variable. Optional: a free [NCBI API key](https://www.ncbi.nlm.nih.gov/account/) for later ClinVar lookups.

## Tests that do not need the network

```bash
pytest tests/test_detect.py
```

## Status vs the interview plan

- [x] Step 0 — `hello_vrs.py`
- [x] Step 1 — detect + pipeline + `vrs-explain` CLI
- [ ] Step 2 — FastAPI `/api/inspect`
- [ ] Step 3 — Identity panel
- [ ] Step 4 — Equivalents + registries
- [ ] Step 5 — Normalization / digest trace
- [ ] Step 6 — Diff mode
- [ ] Step 7 — Federation demo
- [ ] Step 8 — Deploy + fixture mode

Design notes (copied here from the interview prep session):

- `vrs-interview-prep/` — paper/repo summary, open issues, Inspector design
- `traverse-docs/` — core concepts, architecture, step-by-step build plan
