# Working in this repository

- Read README.md and docs/architecture.md before changing module boundaries.
- Backend source is backend/src/spherex; keep HTTP, archive adapters, science and storage separate.
- Use Python 3.12+ and uv.lock. Do not commit .env, data, FITS downloads or local caches.
- Demo data must stay explicitly synthetic; archive errors must never silently activate demo mode.
- Do not describe detector-level stacks/differences as wavelength-matched science products.
- Run ruff check, ruff format --check, pytest and scripts/smoke.py for backend changes.
- After changing API models/routes, export docs/openapi.json and regenerate the API client types.
- Frontend contract and user-visible states are documented in docs/frontend-integration.md.
- Update the roadmap and limitations when introducing scientific capabilities.
- The live IRSA verification is optional and separate from offline CI.
- Docker builds are checked in CI; local Docker is not guaranteed to be installed.
