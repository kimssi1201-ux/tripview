# Durunubi API spec note

Last checked: 2026-08-26 KST

Source: https://www.data.go.kr/data/15101974/openapi.do

## Service

- Public data name: `한국관광공사_두루누비 정보 서비스_GW`
- Provider: Korea Tourism Organization
- Public data portal id: `15101974`
- Format: JSON and XML
- Base URL from the data.go.kr Swagger spec: `https://apis.data.go.kr/B551011/Durunubi`
- Service scope: Korea Dulle Trail and Durunubi walking route information. The public page describes two operations: course list lookup and route list lookup.
- Approval: the public page lists development use as auto-approved and production use as review-based. The repository currently has `TRIPVIEW_API_KEY` and `PHOTO_GALLERY_API_KEY` secrets, but no `DURUNUBI_API_KEY` repository secret was visible in GitHub Actions settings. The actual data.go.kr utilization approval status could not be confirmed without a logged-in data.go.kr account view.

## Secret handling

- Use a dedicated GitHub Actions secret named `DURUNUBI_API_KEY` for this service.
- Do not reuse or log the secret value directly.
- Stage 2 sample testing can optionally try `TRIPVIEW_API_KEY` only if the user confirms the same data.go.kr service key has Durunubi access. If access is denied, stop and ask for the dedicated secret.

## Operation: courseList

- Method and path: `GET /courseList`
- Summary: `코스 목록 정보 조회`
- Description in Swagger: course list lookup.
- Expected request URL: `https://apis.data.go.kr/B551011/Durunubi/courseList`

Parameters:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `numOfRows` | no | string | Results per page |
| `pageNo` | no | string | Page number |
| `MobileOS` | yes | string | OS value such as `IOS`, `AND`, `WIN`, `ETC` |
| `MobileApp` | yes | string | App or service name |
| `serviceKey` | yes | string | data.go.kr service key |
| `crsKorNm` | no | string | Course name |
| `routeIdx` | no | string | Route id |
| `crsLevel` | no | string | Difficulty, `1` low, `2` middle, `3` high |
| `brdDiv` | no | string | Walking or bicycle division. The spec notes `DNWW` for walking routes currently provided. |

Response item fields:

| Field | Meaning for Tripview |
| --- | --- |
| `crsKorNm` | Course name |
| `crsDstnc` | Course distance |
| `crsTotlRqrmHour` | Required time |
| `crsLevel` | Difficulty |
| `sigun` | City or county text |
| `routeIdx` | Route id, useful for joining with `routeList` |
| `crsIdx` | Course id |
| `gpxpath` | GPX path for route geometry |
| `crsSummary` | Course summary |
| `crsContents` | Course content text |
| `crsTourInfo` | Nearby tourism info text |
| `travelerinfo` | Traveler info text |
| `brdDiv` | Walking or bicycle division |
| `crsCycle` | Cycle field from source model |
| `createdtime` | Source created time |
| `modifiedtime` | Source modified time |

Notes:

- There is no `contentId` parameter, so Tripview cannot directly look up a TourAPI post by content id.
- There are no image URL fields in this response model.
- There are no latitude or longitude fields. Route geometry is represented by `gpxpath` when present.
- There is no explicit region code request parameter. Region matching should use Tripview post title, region text, and the response `sigun` value during the sample stage.

## Operation: routeList

- Method and path: `GET /routeList`
- Summary: `길 목록 정보 조회`
- Description in Swagger: route list lookup.
- Expected request URL: `https://apis.data.go.kr/B551011/Durunubi/routeList`

Parameters:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `numOfRows` | no | string | Results per page |
| `pageNo` | no | string | Page number |
| `MobileOS` | yes | string | OS value such as `IOS`, `AND`, `WIN`, `ETC` |
| `MobileApp` | yes | string | App or service name |
| `serviceKey` | yes | string | data.go.kr service key |
| `themeNm` | no in Swagger, required in the current sample path | Route name |
| `brdDiv` | no | string | Walking or bicycle division. The spec notes `DNWW` for walking routes currently provided. |

Response item fields:

| Field | Meaning for Tripview |
| --- | --- |
| `routeIdx` | Route id, useful for joining course rows |
| `themeNm` | Route name |
| `linemsg` | One-line route description |
| `themedescs` | Route description |
| `brdDiv` | Walking or bicycle division |
| `createdtime` | Source created time |
| `modifiedtime` | Source modified time |

Notes:

- `routeList` looks broader than an individual course lookup, but the 2026-08-26 GitHub Actions sample returned `NO_MANDATORY_REQUEST_PARAMETERS_ERROR(SG_APIM)` when called without a route-name search term. The sample script therefore derives route-name candidates from existing Tripview titles and calls `routeList` with `themeNm` before calling `courseList` by `routeIdx`.
- This response also has no image URL or coordinate fields.

## Official Swagger example

The data.go.kr Swagger UI exposes placeholder examples. A real sample response should be captured only in Stage 2 after the correct secret is available.

```json
{
  "header": {
    "resultCode": "string",
    "resultMsg": "string"
  },
  "body": {
    "totalCount": 0,
    "items": {
      "item": {
        "createdtime": "string",
        "travelerinfo": "string",
        "crsTourInfo": "string",
        "crsSummary": "string",
        "routeIdx": "string",
        "crsIdx": "string",
        "crsKorNm": "string",
        "crsDstnc": "string",
        "crsTotlRqrmHour": "string",
        "modifiedtime": "string",
        "sigun": "string",
        "brdDiv": "string",
        "gpxpath": "string",
        "crsLevel": "string",
        "crsCycle": "string",
        "crsContents": "string"
      }
    },
    "numOfRows": 0,
    "pageNo": 0
  }
}
```

## Stage 2 sample plan

Do not run full enrichment before this sample is reviewed.

1. Add a workflow dispatch option such as `durunubi_mode: sample|off`.
2. Select 10 to 20 existing Tripview posts whose title or tags imply walking trails, dulle-gil, forest paths, beaches with walking paths, arboretums, parks, or natural courses.
3. Query `routeList` first with `themeNm` candidates and `brdDiv=DNWW`.
4. Use matching `routeIdx` values to call `courseList`.
5. Log match count, failure count, and the number of matched rows with distance, time, difficulty, and GPX path.
6. Stop after the sample report. Full application needs a separate user instruction.
