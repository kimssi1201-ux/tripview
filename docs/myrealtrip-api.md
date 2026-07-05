# MyRealTrip API Setup

Store the MyRealTrip API key as a GitHub Actions secret.

Secret name:

```text
MYREALTRIP_API_KEY
```

Optional variables:

```text
MYREALTRIP_API_BASE_URL
```

Do not commit the real API key to this repository. Use the secret in scripts and workflows through `process.env.MYREALTRIP_API_KEY`.
