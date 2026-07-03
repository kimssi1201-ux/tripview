# API secret setup

Do not commit real API keys to this repository.

## GitHub Actions

Use this when scheduled jobs or post generation scripts need an API key.

1. Open the GitHub repository.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Click `New repository secret`.
4. Add these names as needed:
   - `TRIPVIEW_API_KEY`: Korea TourAPI service key.
   - `OPENAI_API_KEY`: OpenAI API key for AI-assisted content generation.
5. Save the secret.

The code should read keys from `process.env.TRIPVIEW_API_KEY` or `process.env.OPENAI_API_KEY`.

## Cloudflare Pages

Use this when Cloudflare Pages Functions or Workers need an API key at runtime.

1. Open Cloudflare Dashboard.
2. Go to `Workers & Pages` -> `tripview` -> `Settings`.
3. Open `Environment variables`.
4. Add `OPENAI_API_KEY` as a secret variable.
5. Redeploy the site after saving.

Do not expose `OPENAI_API_KEY` in browser JavaScript. OpenAI requests must run from GitHub Actions, Cloudflare Pages Functions, or another server-side environment.
