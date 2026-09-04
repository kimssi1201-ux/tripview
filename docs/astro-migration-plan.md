# Tripview Astro Migration Plan and PR Notes

## Scope

- Production site: `https://tripview.kr`
- Repository: `kimssi1201-ux/tripview`
- Branch: `astro-migration`
- Deployment target: Cloudflare Pages static output in `dist/`
- Production deploy and merge: out of scope for this PR

The migration keeps the existing data collection, image processing, automation, SEO files, ads, and Cloudflare Pages Functions. The page rendering layer moves from Node-generated HTML in `www/` and `site/` to Astro SSG output in `dist/`.

## Current Pipeline

`npm run build` previously chained data preparation, HTML rendering, homepage/feed generation, image processing, MyRealTrip cache refresh, and `www/` plus `site/` generation through Node scripts.

### Data Collection

- `scripts/update-posts.mjs`
- `scripts/daily-tour-posts.mjs`
- `scripts/backfill-tour-api-details.mjs`
- `scripts/enrich-tour-posts.mjs`
- `scripts/fetch-myrealtrip-products.mjs`
- `scripts/fetch-myrealtrip-accommodations.mjs`
- `scripts/fetch-myrealtrip-tna-products.mjs`
- `scripts/fetch-myrealtrip-flight-deals.mjs`
- `scripts/fetch-coupang-products.mjs`
- `scripts/fetch-pexels-images.mjs`

### Data Cleanup and Quality

- `scripts/merge-manual-posts.mjs`
- `scripts/apply-editorial-review.mjs`
- `scripts/fix-invalid-regions.mjs`
- `scripts/polish-contextual-copy.mjs`
- `scripts/audit-content-quality.mjs`
- `scripts/validate-data-posts.mjs`
- `scripts/lib/content-quality.mjs`

### Image Processing

- `scripts/process-tour-images.mjs`
- `data/processed-tour-images.json`
- `data/pexels-images.json`
- `assets/processed/`

The existing processed image sizes and manifests remain the source of truth. Astro consumes these assets and adds `width`, `height`, `loading`, and no-crop rendering policy where appropriate.

### HTML/Page Generation

These scripts are kept for legacy comparison, but the equivalent final page rendering is handled by Astro:

- `scripts/build-www.mjs`
- `scripts/build-homepage.mjs`
- `scripts/render-manual-pages.mjs`
- `scripts/render-valley-pages.mjs`
- `scripts/apply-homepage-content-config.mjs`
- `scripts/build-feed.mjs`

### Keep

- Data collection: TourAPI, manual posts, MyRealTrip, Coupang, Pexels, enrichment, and refresh scripts.
- Data cleanup: editorial review, invalid region repair, quality audit, data validation.
- Image generation: `scripts/process-tour-images.mjs`, `assets/processed/`, `data/processed-tour-images.json`, `data/pexels-images.json`.
- Runtime/API: `functions/`, Cloudflare Pages routing, MyRealTrip API, Coupang API, existing env secret names.
- SEO/public assets: `robots.txt`, `ads.txt`, favicon files, manifest, `_headers`, `_redirects`.

### Replaced by Astro

- Root homepage HTML rendering.
- Article HTML rendering for generated and manual slugs.
- Category hub rendering for `/travel/`, `/festival/`, `/stay/`, `/ticket/`.
- Region hub rendering for `/region/` and `/region/{slug}/`.
- Shared header, footer, breadcrumb, cards, related posts, article metadata, image frame, SEO head, RSS, and sitemap rendering.

### Delete Candidates After Production Validation

These are intentionally not deleted in this PR:

- `scripts/build-www.mjs`
- `scripts/build-homepage.mjs`
- `scripts/render-manual-pages.mjs`
- `scripts/render-valley-pages.mjs`
- `scripts/apply-homepage-content-config.mjs`
- legacy generated root/article/category HTML files
- legacy `site/` and `www/` generation flow

### Deployment Tree

- Legacy output: `www/`, `site/`
- Astro output: `dist/`
- Cloudflare Pages Functions in `functions/` are preserved and continue to route through `context.env.ASSETS.fetch(request)`.

## New Pipeline

`npm run build` now runs:

1. `node scripts/prepare-data.mjs`
2. `node scripts/run-astro-build.mjs`
3. `node scripts/postbuild-astro-static.mjs`
4. `node scripts/validate-astro-migration.mjs`

`npm run build:legacy` preserves the old Node generator chain for fallback and comparison.

## Astro Structure

- `src/lib/content.mjs`
- `src/lib/static-pages.mjs`
- `src/layouts/BaseLayout.astro`
- `src/layouts/ArticleLayout.astro`
- `src/layouts/RegionLayout.astro`
- `src/layouts/StaticPageLayout.astro`
- `src/components/Header.astro`
- `src/components/Footer.astro`
- `src/components/TravelCard.astro`
- `src/components/ProductCard.astro`
- `src/components/MediaFrame.astro`
- `src/components/Breadcrumbs.astro`
- `src/components/ArticleMeta.astro`
- `src/components/RelatedPosts.astro`
- `src/components/ShareToolbar.astro`
- `src/pages/index.astro`
- `src/pages/[slug].astro`
- `src/pages/travel/index.astro`
- `src/pages/festival/index.astro`
- `src/pages/stay/index.astro`
- `src/pages/ticket/index.astro`
- `src/pages/region/index.astro`
- `src/pages/region/[region].astro`
- `src/pages/flight-deals/index.astro`
- `src/pages/flight-deals/[deal].astro`
- `src/pages/sitemap.xml.js`
- `src/pages/rss.xml.js`
- `src/pages/feed.xml.js`

## URL Policy

Existing slugs are not rewritten. Astro `getStaticPaths()` reads `data/generated-posts.json` and creates pages at the same root URL shape, for example:

- `/travel-127722/`
- `/travel-osaka-september-2026/`
- `/festival-3351451/`
- `/region/gangwon/`

The migration validator compares the legacy root `sitemap.xml` URL set against `dist/sitemap.xml` and fails on missing or extra URLs.

## SEO Policy

Astro preserves or regenerates:

- `title`
- `meta description`
- `canonical`
- Open Graph
- Twitter Card
- Article JSON-LD
- Event/Lodging JSON-LD where applicable
- Breadcrumb JSON-LD
- `datePublished`
- `dateModified`
- `robots`
- Naver verification meta
- AdSense publisher script and `ads.txt`

## Image Policy

- Processed TourAPI images remain preferred for hero/card/banner output.
- Pexels and external images are consumed from existing manifests.
- Cards and article frames support no-crop rendering with `object-fit: contain` over a blurred same-image background.
- Known processed images can still use cover mode when the generated asset already matches the frame.
- Main LCP hero images are eager; non-critical images are lazy.
- Major images include width and height when known.

## Cloudflare Impact

- `functions/` is not migrated to Astro API routes in this pass.
- Environment variable and secret names are unchanged.
- `functions/[[path]].js` keeps the existing asset routing model through `context.env.ASSETS.fetch(request)`.
- Cloudflare Pages expected configuration after this PR:
  - Build command: `npm run build`
  - Build output directory: `dist`
- Production deployment settings are not changed by this PR.

## Validation

`scripts/validate-astro-migration.mjs` checks:

- Sitemap URL set parity
- Dist file existence for sitemap URLs
- `title`, description, canonical, and H1 presence
- Canonical and H1 parity against legacy HTML when present
- Main article text snippets from JSON data

### Migration Validation Result

- Legacy sitemap URLs: 106
- Astro sitemap URLs: 106
- Missing URLs: 0
- Extra URLs: 0
- Indexable article URLs: 78
- Total generated article pages in Astro route: 710
- RSS items: 50 before / 50 after
- Sample parity checked: `https://tripview.kr/travel-2706344/` title, canonical, and H1 match legacy output.

### Screen Validation Result

Local Astro preview was checked at:

- 360px
- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px

Pages checked:

- `/`
- `/travel/`
- `/festival/`
- `/stay/`
- `/ticket/`
- `/region/gangwon/`
- `/travel-2706344/`
- `/travel-osaka-september-2026/`

Result:

- Horizontal overflow: 0 failures
- Visible broken images: 0 failures
- Home hero image: loaded at all checked widths
- Home recommendation rail: 4 compact-capable items
- Search: `강원` returned 8 results
- Domestic article inline images: 5
- Overseas article inline images: 4
- Coupang cards on domestic article: 6 cards, 6 images loaded after scrolling to the section
- MyRealTrip accommodation/ticket cards present in article product sections

### SEO Comparison

- `title`, `description`, canonical, H1, robots, RSS alternate, favicon/manifest links, Naver verification meta, and AdSense publisher script are generated from Astro layouts.
- Article pages include Article JSON-LD and Breadcrumb JSON-LD.
- Festival and lodging pages keep their specialized JSON-LD in addition to Article/Breadcrumb data.
- Canonical/H1 parity is enforced for sitemap URLs where legacy HTML exists.

### Sitemap and RSS

- `/sitemap.xml` is generated by Astro from the same indexability rules.
- `/site/sitemap.xml` is copied from the Astro sitemap for the existing Cloudflare Function fallback path.
- `/rss.xml` and `/feed.xml` are both generated/copied with 50 items to keep the current feed URLs valid.

### Image Handling

- Existing processed TourAPI images remain preferred for domestic travel, festival, and region pages.
- Existing Pexels manifest images are used for overseas posts.
- External images and untrusted aspect ratios render through a contain-over-blurred-background media frame.
- Known generated WebP assets can still use cover mode where dimensions already match the frame.
- Hero images use eager loading and known dimensions where available.
- Non-critical card, related, inline, and product images use lazy loading and async decoding.
- `articleInlineAssets()` keeps article body images to 3-5 images when enough photos are available.
- Tourism image family keys handle both `/resource/` and `/resource_photo/` paths to prevent duplicate same-content photos in article body placement.

### Ads and Affiliate Blocks

- AdSense publisher ID is unchanged.
- `ads.txt` is copied to `dist`.
- Share toolbar keeps Kakao/Naver/X/Band/copy/font controls and excludes Facebook.
- MyRealTrip product sections are rendered statically from cached data.
- Coupang section still uses the Pages Function first, with a static `/data/coupang-products.json` fallback for local static preview and API failure paths.
- Coupang image referrer policy remains `strict-origin-when-cross-origin`.

### Automatic Content Updates

The update path is now:

1. Existing data collection and cleanup scripts update JSON and processed assets.
2. Astro reads the JSON/manifest data.
3. `dist/` is generated.
4. The validator fails the build if sitemap URL parity or core SEO fields regress.

`npm run build:legacy` remains available for fallback comparison while this migration is reviewed.

GitHub Actions workflows that publish or refresh generated content now install project dependencies and use `npm run build` for the final static output instead of calling the legacy homepage/feed/article HTML generators directly. Generated `dist/` remains ignored and is not committed by scheduled update workflows; Cloudflare Pages should build it from source.

Legacy one-off maintenance workflows for category hub counts and public wording polish were converted to read-only Astro validation workflows. The new `Astro Migration Checks` workflow runs lint, tests, content audit, and the full Astro build on pull requests to `main` and pushes to `astro-migration`.

### Test Results

- Install: `pnpm install` succeeded locally because this host has bundled `node.exe` but no `npm` binary. The repository scripts remain npm-compatible through `package.json`.
- `npm run lint` equivalent: `node scripts/check-syntax.mjs` passed, 79 JavaScript files.
- `npm test` equivalent: `node --test tests/*.test.mjs` passed, 109 tests.
- `npm run audit:content` equivalent: `node scripts/audit-content-quality.mjs` passed, audited 710 posts.
- `npm run build` equivalent: `pnpm run build` passed through `prepare:data`, Astro build, postbuild, and migration validation.
- `git diff --check` passed.

### Performance Comparison

Static file comparison:

- `/index.html`: 50,373 bytes legacy / 43,274 bytes Astro
- `/travel-2706344/index.html`: 81,024 bytes legacy / 47,631 bytes Astro
- `/region/gangwon/index.html`: 47,780 bytes legacy / 29,064 bytes Astro

JavaScript:

- Astro emitted no client runtime JS bundle for static content.
- Shared Astro CSS bundle: 15,327 bytes.
- Client JS is limited to existing interactive assets: `topic-filter.js` 17,151 bytes, `article-share.js` 2,790 bytes, `coupang.js` 5,616 bytes, plus the existing AdSense script.

Image request shape:

- Home image tag count remains 35.
- The sampled domestic article increases image tags because inline photos, related cards, MyRealTrip, and Coupang blocks are now rendered/available in one article template.
- Width/height attributes and fixed media ratios are used to reduce layout shift risk.
- Browser wrapper did not expose Web Vitals entries directly, so LCP/CLS are not claimed as lab scores in this PR.

### Remaining Risks

- Production Cloudflare Pages must be configured to use `dist` as the output directory before merging/deploying.
- The manual GitHub Pages workflow remains `workflow_dispatch`-only and should be reviewed before use; Cloudflare Pages remains the intended production target.
- Local verification used cached MyRealTrip/Pexels data because API keys were not available in the sandbox.
- `scripts/process-tour-images.mjs` still writes timestamped manifest output during builds; this was not normalized in the migration PR to avoid changing the image pipeline semantics.
- Generated `dist/` is not committed in this PR because it is about 130 MB and reproducible from source. Cloudflare should build it from the branch.

### Manual Review Checklist

- Confirm Cloudflare Pages build command is `npm run build`.
- Confirm Cloudflare Pages output directory is `dist`.
- Open `/`, `/travel/`, `/festival/`, `/stay/`, `/ticket/`, `/region/gangwon/`, `/travel-2706344/`, and `/travel-osaka-september-2026/`.
- Check Naver Search Advisor and Google Search Console verification still show verified after deployment.
- Check AdSense and Coupang/MyRealTrip affiliate disclosures visually.
- Compare a few high-traffic article URLs against Search Console before production rollout.
- Keep PR unmerged until production preview is reviewed.
