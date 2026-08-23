# traVRS frontend

Vite + React + TypeScript UI for the inspect API. Node **24** (see `.nvmrc`).

Visual tokens live in [`design.md`](design.md).

## Run

```bash
nvm use
npm install
npm run dev
```

Opens http://localhost:5173 and proxies `/api` to `travrs-serve` on port 8000.
Start the backend first (`cd ../backend && .venv/bin/travrs-serve`).

```bash
npm run build
npm run preview
```
