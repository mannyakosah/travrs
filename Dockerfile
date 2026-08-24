# syntax=docker/dockerfile:1
# Production image: Vite UI + FastAPI / vrs-python.
# Cloud Run sets PORT. Local: docker build -t travrs . && docker run --rm -p 8080:8080 travrs

FROM node:24-bookworm-slim AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm AS api
WORKDIR /src
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/pyproject.toml backend/README.md ./
COPY backend/travrs ./travrs
RUN pip install --no-cache-dir ".[web]"

FROM python:3.12-slim-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1001 travrs
WORKDIR /app
COPY --from=api /usr/local /usr/local
COPY --from=ui /ui/dist /app/ui
USER travrs
ENV TRAVRS_STATIC_DIR=/app/ui \
    TRAVRS_HOST=0.0.0.0 \
    TRAVRS_RELOAD=0 \
    TRAVRS_CACHE_DIR=/tmp/travrs-cache \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8080'))"
CMD ["sh", "-c", "uvicorn travrs.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
