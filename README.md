# traVRS

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
HTTP (`POST /api/inspect`). The production `Dockerfile` builds both and the
API serves the UI, so Cloud Run is one container.

## Quick start

**Backend** — Python 3.12:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,web]"
travrs-serve
```

**Frontend** — Node 24 LTS (do not change your nvm default if you still need Node 14 for seqr):

```bash
cd frontend
nvm use
npm install
npm run dev
```

UI: http://localhost:5173 · API: http://127.0.0.1:8000/docs

See [backend/README.md](backend/README.md) for the CLI, example variants, and tests.
See [frontend/README.md](frontend/README.md) for the design system and build commands.

## Docker

One image: built UI plus the FastAPI / vrs-python process. Cloud Run sets `PORT`.

```bash
docker build -t travrs .
docker run --rm -p 8080:8080 travrs
```

http://127.0.0.1:8080 · `/health` · `/glossary` · `/api/inspect`

Cache writes to `/tmp/travrs-cache` (ephemeral on Cloud Run unless you mount a volume).
Public SeqRepo + UTA are the defaults. Extra browser origins (if the UI is not
same-origin): `TRAVRS_CORS_ORIGINS=https://your-app.web.app`.

## Deploy (Cloud Run + Firebase Hosting)

Create a **new Firebase project** in the [Firebase console](https://console.firebase.google.com/).
That *is* a Google Cloud project; Hosting and `PROJECT_ID.web.app` come with it.
Do not start in Cloud Console unless you then “Add Firebase” to that same project.

Prefer a dedicated project (not an existing app). After it exists:

```bash
gcloud auth login
npx -y firebase-tools@latest login
export GOOGLE_CLOUD_PROJECT=trytravrs
./scripts/deploy.sh
```

The script builds the image on Cloud Build, deploys Cloud Run service `travrs`
in `us-central1`, builds the Vite UI, and deploys Hosting. `firebase.json`
sends `/api/**` to Cloud Run and everything else to the SPA.

Probe Cloud Run at `/health`. First inspect after a cold start can be slow;
set `--min-instances=1` on the `gcloud run deploy` line for interview week.

GitHub Actions (`.github/workflows/ci.yml`) runs tests on every PR and push
to `main`. Production deploy from Actions is a follow-up once the project id
and deploy credentials exist.
