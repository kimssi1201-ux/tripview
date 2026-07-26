# API secret setup

Do not commit real API keys to this repository.

## GitHub Actions

Use this when scheduled jobs or post generation scripts need an API key.

1. Open the GitHub repository.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Click `New repository secret`.
4. Add these names as needed:
   - `TRIPVIEW_API_KEY`: Korea TourAPI service key.
   - `BEACH_INFO_API_KEY`: data.go.kr key for the Ministry of Oceans beach information API. `TRIPVIEW_API_KEY` is used as a fallback.
   - `OPENAI_API_KEY`: OpenAI API key for AI-assisted content generation.
   - `OPENAI_MODEL`: optional repository variable. Defaults to `gpt-5.5`.
   - `OPENAI_ENRICH_LIMIT`: optional repository variable. Defaults to `10`.
   - `OPENAI_TIMEOUT_MS`: optional repository variable. Defaults to `90000`.
5. Save the secret.

The code should read keys from `process.env.TRIPVIEW_API_KEY` or `process.env.OPENAI_API_KEY`.

## Cloudflare Pages

Use this when Cloudflare Pages Functions or Workers need an API key at runtime.

1. Open Cloudflare Dashboard.
2. Go to `Workers & Pages` -> `tripview` -> `Settings`.
3. Open `Environment variables`.
4. Add `OPENAI_API_KEY` as a secret variable.
5. Add `BEACH_INFO_API_KEY` as a secret variable, or reuse the existing `TRIPVIEW_API_KEY`.
6. Redeploy the site after saving.

Do not expose `OPENAI_API_KEY` in browser JavaScript. OpenAI requests must run from GitHub Actions, Cloudflare Pages Functions, or another server-side environment.
