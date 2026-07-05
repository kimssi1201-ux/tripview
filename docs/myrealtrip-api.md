# MyRealTrip API Setup

Store the MyRealTrip API key as a GitHub Actions secret. The partner docs may call this key `PARTNER_API_KEY`; this project accepts both names.

Accepted secret names:

```text
MYREALTRIP_API_KEY
PARTNER_API_KEY
MYREALTRIP_PARTNER_API_KEY
```

Optional endpoint variables:

```text
MYREALTRIP_API_BASE_URL
MYREALTRIP_PRODUCTS_URL
MYREALTRIP_API_URL
MYREALTRIP_ENDPOINT_URL
PARTNER_API_URL
PARTNER_PRODUCTS_URL
```

Optional auth variables:

```text
MYREALTRIP_AUTH_MODE
MYREALTRIP_API_KEY_PARAM
MYREALTRIP_API_KEY_HEADER
MYREALTRIP_PRODUCT_LIMIT
```

Default authentication matches the partner docs:

```text
Authorization: Bearer YOUR_API_KEY
```

Do not commit the real API key to this repository. Use GitHub Secrets or Cloudflare environment variables only.

## Revenue API

The documented endpoint below is a private settlement/revenue API, not a public product feed:

```text
https://partner-ext-api.myrealtrip.com/v1/revenues?startDate=2025-01-01&endDate=2025-01-07&dateSearchType=SETTLEMENT
```

Do not map revenue data into public homepage cards. Use it only for private reporting or validation.

## Mapping

`scripts/fetch-myrealtrip-products.mjs` normalizes API products into `data/myrealtrip-products.json`.

The homepage reads that file and maps products into the `예약 전 체크` section by:

- region match: Seoul, Busan, Jeju, Gangwon, etc.
- travel intent: water, indoor, festival, family, booking
- product type keywords: tour, ticket, activity, stay, transport, discount

For public site cards, request or configure a product/tour/ticket/deeplink feed endpoint that returns fields such as title, URL, image, price, region, category, and description. If no product endpoint URL is configured, the fetch step exits safely and the site keeps the existing booking guide cards.
