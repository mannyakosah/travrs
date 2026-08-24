#!/usr/bin/env bash
# Deploy this project to trytravrs (Firebase Hosting + Cloud Run).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${GOOGLE_CLOUD_PROJECT:-trytravrs}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-travrs}"

gcloud config set project "$PROJECT"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  containerregistry.googleapis.com

gcloud run deploy "$SERVICE" \
  --source "$ROOT" \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 20 \
  --min-instances 0 \
  --max-instances 3 \
  --port 8080 \
  --cpu-boost \
  --quiet

(cd frontend && npm ci && npm run build)

npx -y firebase-tools@latest deploy --only hosting --project "$PROJECT" --non-interactive

echo
echo "Hosting:  https://${PROJECT}.web.app"
echo "Cloud Run: gcloud run services describe ${SERVICE} --region ${REGION} --format='value(status.url)'"
