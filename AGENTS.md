# Tripview Development Guide

## Project Overview

Tripview is a static travel magazine generated from HTML data and Node.js scripts.
Cloudflare Pages Functions in `functions/` provide API and routing handlers.
The generated deployment trees are `site/` and `www/`.

## Prerequisites

- Node.js 20 or newer
- npm (the repository has no third-party runtime dependencies)

## Run and Build

- Install dependencies if the project later adds any: `npm install`
- Build generated pages: `npm run build`
- Run the content audit: `npm run audit:content`
- Refresh content from the configured local workflow: `npm run refresh`

The project is deployed as a static site through Cloudflare Pages. Do not call production APIs while testing.

## Tests and Lint

- Run the complete test suite: `npm test`
- Run JavaScript syntax checks: `npm run lint`

Tests use Node's built-in `node:test` runner. API tests replace `fetch` and Cloudflare asset bindings with local mocks.

## Required Verification After Code Changes

1. Run `npm run lint`.
2. Run `npm test`.
3. If a generator, template, or content pipeline changed, run `npm run build` and then rerun `npm test`.
4. Review `git diff --check` before committing.

Do not commit API keys, `.env.local`, generated secrets, or production credentials.
