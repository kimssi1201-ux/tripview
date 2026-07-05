# MyRealTrip API Setup

Store the MyRealTrip API key as a GitHub Actions secret.

Secret name:

```text
MYREALTRIP_API_KEY
```

Optional variables:

```text
MYREALTRIP_API_BASE_URL
MYREALTRIP_PRODUCTS_URL
MYREALTRIP_AUTH_MODE
MYREALTRIP_API_KEY_PARAM
MYREALTRIP_API_KEY_HEADER
MYREALTRIP_PRODUCT_LIMIT
```

Do not commit the real API key to this repository. Use the secret in scripts and workflows through `process.env.MYREALTRIP_API_KEY`.

## Mapping

`scripts/fetch-myrealtrip-products.mjs` normalizes API products into `data/myrealtrip-products.json`.

The homepage reads that file and maps products into the `예약 전 체크` section by:

- region match: Seoul, Busan, Jeju, Gangwon, etc.
- travel intent: water, indoor, festival, family, booking
- product type keywords: tour, ticket, activity, stay, transport, discount

If no endpoint URL is configured, the fetch step exits safely and the site keeps the existing booking guide cards.
