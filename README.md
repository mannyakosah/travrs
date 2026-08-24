# traVRS

**Live: [trytravrs.web.app](https://trytravrs.web.app)**

**traVRS** (pronounced *traverse*) — trace any variant through the verse.

A developer-experience tool for the [GA4GH Variation Representation Specification](https://vrs.ga4gh.org) (VRS, pronounced *verse*). Paste HGVS, SPDI, gnomAD/VCF, or VRS JSON; get a normalized VRS Allele, a globally computed `ga4gh:VA.` identifier, and equivalent representations.

This is **not** a reimplementation of VRS. Translation, normalization, and computed identifiers all go through the official reference library, [vrs-python](https://github.com/ga4gh/vrs-python).

```
Input        NM_007294.4:c.68_69del          (BRCA1 185delAG)
     ↓  AlleleTranslator + SeqRepo + UTA
VRS Allele   { "type": "Allele", … }
Identifier   ga4gh:VA.…
Equivalents  SPDI / HGVS on the same sequence context
```

No local sequence download. No local Postgres. Public SeqRepo REST + public UTA.

## Layout

```
backend/     Python package, CLI, HTTP API
frontend/    Vite + React UI
```

Each side has its own install, lockfile, and README. Locally they talk over
HTTP (`POST /api/inspect`).

## Quick start

**Backend** — Python 3.12:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,web]"
travrs-serve
```

**Frontend** — Node 24 LTS:

```bash
cd frontend
nvm use
npm install
npm run dev
```

UI: http://localhost:5173 · API: http://127.0.0.1:8000/docs

See [backend/README.md](backend/README.md) for the CLI, example variants, and tests.
See [frontend/README.md](frontend/README.md) for the design system and build commands.

**Image** — UI and API in one container:

```bash
docker build -t travrs .
docker run --rm -p 8080:8080 travrs
```
