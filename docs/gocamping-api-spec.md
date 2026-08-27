# GoCamping API spec note

Last checked: 2026-08-27 KST

Source: https://www.data.go.kr/data/15101933/openapi.do

## Service

- Public data name: `한국관광공사_고캠핑 정보 조회서비스_GW`
- Provider: Korea Tourism Organization
- Public data portal id: `15101933`
- Format: JSON and XML
- Base URL from the data.go.kr Swagger spec: `https://apis.data.go.kr/B551011/GoCamping`
- Legacy operation URLs shown inside the public page use `https://gwapi.visitkorea.or.kr/openapi/service/gwrest/GoCamping`; the sample script tries the current `apis.data.go.kr` base first and keeps the legacy base as a fallback.
- Reference document listed on data.go.kr: `TourAPI_Guide_(고캠핑)v4.1.zip`
- Public page description: campground operating information collected from registered local government campground records, including campground name, type, location, convenience facilities, and safety facilities.
- Approval: the public page lists development use as auto-approved and production use as review-based.

## Secret handling

- Prefer a dedicated GitHub Actions secret named `GOCAMPING_API_KEY` for this service.
- The sample script can also try the existing `TRIPVIEW_API_KEY` because the service belongs to the same Korea Tourism Organization gateway family, but access must be verified by an actual call.
- The Swagger lists `serviceKey`; the sample script also tries `ServiceKey` because gateway-family services sometimes differ between current and legacy operation URLs.
- Do not log or commit the secret value. Logs should only show which secret name worked.
- If both `GOCAMPING_API_KEY` and `TRIPVIEW_API_KEY` are unavailable or rejected with a service access error, add `GOCAMPING_API_KEY` in GitHub Actions secrets before running the sample.

## Tripview join and matching notes

- `contentId` is present in the GoCamping list responses and in `imageList`.
- Tripview generated posts currently store the TourAPI id as lowercase `contentid`; the safest sample match is direct equality between `String(post.contentid)` and `String(item.contentId)`.
- `data/generated-posts.json` did not expose a reliable `contentTypeId` field during local inspection. A title/source-title/tag prefilter found camping-like candidates, then the sample uses direct `contentid` to `contentId` matching first.
- Existing Tripview generated posts did not expose usable top-level `mapX` or `mapY` coordinates during the 2026-08-27 local inspection, so coordinate-first matching is not available for current posts unless coordinates are added later.
- GoCamping responses do include `mapX` and `mapY`, and `locationBasedList` also accepts `mapX`, `mapY`, and `radius`. If Tripview posts later carry coordinates, location-based matching can become the first pass.
- `firstImageUrl` exists in the main campground list responses. Additional images are available from `imageList.imageUrl` by `contentId`.

## Operations

### `GET /basedList`

- Operation id: `basedList`
- Summary: `기본 정보 목록 조회`
- Description: `고캠핑 기본정보 목록을 조회하는 기능입니다.`

Parameters:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `numOfRows` | no | number | 한페이지결과수 |
| `pageNo` | no | number | 페이지번호 |
| `MobileOS` | yes | string | OS 구분: `IOS`, `AND`, `WIN`, `ETC` |
| `MobileApp` | yes | string | 서비스명 또는 어플명 |
| `serviceKey` | yes | string | 인증키 |
| `_type` | no | string | REST URL 호출 시 `json` 값을 추가하면 JSON 응답. 기본은 XML |

Response body fields:

| Field | Type | Description |
| --- | --- | --- |
| `numOfRows` | number | 한 페이지의 결과 수 |
| `pageNo` | number | 현재 조회된 데이터의 페이지 번호 |
| `totalCount` | number | 전체 데이터의 총 수 |
| `items.item[]` | object | Campground item fields listed below |

Item fields: full campground item fields listed in the `Campground item fields` section.

### `GET /locationBasedList`

- Operation id: `locationBasedList`
- Summary: `위치기반정보 목록 조회`
- Description: `내주변 좌표를 기반으로 고캠핑정보 목록을 조회하는 기능입니다.`

Parameters:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `numOfRows` | no | number | 한페이지결과수 |
| `pageNo` | no | number | 페이지번호 |
| `MobileOS` | yes | string | OS 구분: `IOS`, `AND`, `WIN`, `ETC` |
| `MobileApp` | yes | string | 서비스명 또는 어플명 |
| `serviceKey` | yes | string | 인증키 |
| `_type` | no | string | REST URL 호출 시 `json` 값을 추가하면 JSON 응답. 기본은 XML |
| `mapX` | yes | string | 경도, GPS X좌표(WGS84) |
| `mapY` | yes | string | 위도, GPS Y좌표(WGS84) |
| `radius` | yes | string | 거리 반경, 단위 m, 최대 20000m(20km) |

Response body fields:

| Field | Type | Description |
| --- | --- | --- |
| `numOfRows` | number | 한 페이지의 결과 수 |
| `pageNo` | number | 현재 조회된 데이터의 페이지 번호 |
| `totalCount` | number | 전체 데이터의 총 수 |
| `items.item[]` | object | Campground item fields listed below |

Item fields: full campground item fields listed in the `Campground item fields` section.

### `GET /searchList`

- Operation id: `searchList`
- Summary: `키워드 검색 목록 조회`
- Description: `키워드로 검색을 하여 고캠핑정보 목록을 조회하는 기능입니다.`

Parameters:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `numOfRows` | no | number | 한페이지결과수 |
| `pageNo` | no | number | 페이지번호 |
| `MobileOS` | yes | string | OS 구분: `IOS`, `AND`, `WIN`, `ETC` |
| `MobileApp` | yes | string | 서비스명 또는 어플명 |
| `serviceKey` | yes | string | 인증키 |
| `_type` | no | string | REST URL 호출 시 `json` 값을 추가하면 JSON 응답. 기본은 XML |
| `keyword` | yes | string | 요청 키워드. Swagger example says `야영장`; encode Korean keywords in URL calls |

Response body fields:

| Field | Type | Description |
| --- | --- | --- |
| `numOfRows` | number | 한 페이지의 결과 수 |
| `pageNo` | number | 현재 조회된 데이터의 페이지 번호 |
| `totalCount` | number | 전체 데이터의 총 수 |
| `items.item[]` | object | Campground item fields listed below |

Item fields: full campground item fields listed in the `Campground item fields` section.

### `GET /imageList`

- Operation id: `imageList`
- Summary: `이미지정보 목록 조회`
- Description: `각 고캠핑 콘텐츠에 해당하는 이미지URL 목록을 조회하는 기능입니다.`

Parameters:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `numOfRows` | no | number | 한페이지결과수 |
| `pageNo` | no | number | 페이지번호 |
| `MobileOS` | yes | string | OS 구분: `IOS`, `AND`, `WIN`, `ETC` |
| `MobileApp` | yes | string | 서비스명 또는 어플명 |
| `serviceKey` | yes | string | 인증키 |
| `_type` | no | string | REST URL 호출 시 `json` 값을 추가하면 JSON 응답. 기본은 XML |
| `contentId` | yes | string | 콘텐츠ID |

Response body fields:

| Field | Type | Description |
| --- | --- | --- |
| `pageNo` | number | 현재 조회된 데이터의 페이지 번호 |
| `totalCount` | number | 전체 데이터의 총 수 |
| `items.item[]` | object | Image item fields listed below |
| `numOfRows` | number | 한 페이지의 결과 수 |

Image item fields:

| Field | Type | Description |
| --- | --- | --- |
| `contentId` | string | 콘텐츠 ID |
| `serialnum` | string | 이미지 일련번호 |
| `imageUrl` | string | 이미지 URL |
| `createdtime` | string | 등록일 |
| `modifiedtime` | string | 수정일 |

### `GET /basedSyncList`

- Operation id: `basedSyncList`
- Summary: `동기화 목록 조회`
- Description: `고캠핑 정보 동기화 목록을 조회하는 기능`

Parameters:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `numOfRows` | no | number | 한페이지결과수 |
| `pageNo` | no | number | 페이지번호 |
| `MobileOS` | yes | string | OS 구분: `IOS`, `AND`, `WIN`, `ETC` |
| `MobileApp` | yes | string | 서비스명 또는 어플명 |
| `serviceKey` | yes | string | 인증키 |
| `_type` | no | string | REST URL 호출 시 `json` 값을 추가하면 JSON 응답. 기본은 XML |
| `syncStatus` | no | string | 콘텐츠상태: `A` 신규, `U` 수정, `D` 삭제 |
| `syncModTime` | no | string | 수정일. 수정년도, 수정년월, 수정년월일 입력 |

Response body fields:

| Field | Type | Description |
| --- | --- | --- |
| `numOfRows` | number | 한 페이지의 결과 수 |
| `pageNo` | number | 현재 조회된 데이터의 페이지 번호 |
| `totalCount` | number | 전체 데이터의 총 수 |
| `items.item[]` | object | Campground item fields listed below, plus `syncStatus` |

Item fields: full campground item fields listed in the `Campground item fields` section, plus `syncStatus`.

## Campground item fields

The Swagger definitions for `basedList`, `locationBasedList`, `searchList`, and `basedSyncList` expose the following campground item fields. Field order differs by operation. `basedSyncList` additionally includes `syncStatus`.

| Field | Type | Description |
| --- | --- | --- |
| `contentId` | string | 콘텐츠 ID |
| `facltNm` | string | 야영장명 |
| `lineIntro` | string | 한줄소개 |
| `intro` | string | 소개 |
| `facltDivNm` | string | 사업주체.구분 |
| `bizrno` | string | 사업자번호 |
| `trsagntNo` | string | 관광사업자번호 |
| `mangeDivNm` | string | 운영주체.관리주체(직영, 위탁) |
| `mgcDiv` | string | 운영기관.관리기관 |
| `manageSttus` | string | 운영상태.관리상태 |
| `featureNm` | string | 특징 |
| `induty` | string | 업종 |
| `lctCl` | string | 입지구분 |
| `doNm` | string | 도 |
| `sigunguNm` | string | 시군구 |
| `zipcode` | string | 우편번호 |
| `addr1` | string | 주소 |
| `addr2` | string | 주소상세 |
| `mapX` | string | 경도(X) |
| `mapY` | string | 위도(Y) |
| `direction` | string | 오시는 길 컨텐츠 |
| `tel` | string | 전화 |
| `homepage` | string | 홈페이지 |
| `resveUrl` | string | 예약 페이지 |
| `resveCl` | string | 예약 구분 |
| `manageNmpr` | string | 상주관리인원 |
| `gnrlSiteCo` | string | 주요시설 일반야영장 |
| `autoSiteCo` | string | 주요시설 자동차야영장 |
| `glampSiteCo` | string | 주요시설 글램핑 |
| `caravSiteCo` | string | 주요시설 카라반 |
| `indvdlCaravSiteCo` | string | 주요시설 개인 카라반 |
| `sitedStnc` | string | 사이트간 거리 |
| `siteMg1Width` | string | 사이트 크기1 가로 |
| `siteMg2Width` | string | 사이트 크기2 가로 |
| `siteMg3Width` | string | 사이트 크기3 가로 |
| `siteMg1Vrticl` | string | 사이트 크기1 세로 |
| `siteMg2Vrticl` | string | 사이트 크기2 세로 |
| `siteMg3Vrticl` | string | 사이트 크기3 세로 |
| `siteMg1Co` | string | 사이트 크기1 수량 |
| `siteMg2Co` | string | 사이트 크기2 수량 |
| `siteMg3Co` | string | 사이트 크기3 수량 |
| `siteBottomCl1` | string | 잔디 |
| `siteBottomCl2` | string | 파쇄석 |
| `siteBottomCl3` | string | 데크 |
| `siteBottomCl4` | string | 자갈 |
| `siteBottomCl5` | string | 맨흙 |
| `tooltip` | string | 툴팁 |
| `glampInnerFclty` | string | 글램핑 내부시설 |
| `caravInnerFclty` | string | 카라반 내부시설 |
| `prmisnDe` | string | 인허가일자 |
| `operPdCl` | string | 운영기간 |
| `operDeCl` | string | 운영일 |
| `hvofBgnde` | string | 휴장기간.휴무기간 시작일 |
| `hvofEnddle` | string | 휴장기간.휴무기간 종료일 |
| `trlerAcmpnyAt` | string | 개인 트레일러 동반 여부(Y/N) |
| `caravAcmpnyAt` | string | 개인 카라반 동반 여부(Y/N) |
| `toiletCo` | string | 화장실 개수 |
| `swrmCo` | string | 샤워실 개수 |
| `wtrplCo` | string | 개수대 개수 |
| `brazierCl` | string | 화로대 |
| `sbrsCl` | string | 부대시설 |
| `sbrsEtc` | string | 부대시설 기타 |
| `posblFcltyCl` | string | 주변이용가능시설 |
| `posblFcltyEtc` | string | 주변이용가능시설 기타 |
| `clturEventAt` | string | 자체문화행사 여부(Y/N) |
| `clturEvent` | string | 자체문화행사명 |
| `exprnProgrmAt` | string | 체험프로그램 여부(Y/N) |
| `exprnProgrm` | string | 체험프로그램명 |
| `extshrCo` | string | 소화기 개수 |
| `frprvtWrppCo` | string | 방화수 개수 |
| `frprvtSandCo` | string | 방화사 개수 |
| `fireSensorCo` | string | 화재감지기 개수 |
| `themaEnvrnCl` | string | 테마환경 |
| `eqpmnLendCl` | string | 캠핑장비대여 |
| `animalCmgCl` | string | 애완동물출입 |
| `tourEraCl` | string | 여행시기 |
| `firstImageUrl` | string | 대표이미지 |
| `createdtime` | string | 등록일 |
| `modifiedtime` | string | 수정일 |
| `allar` | string | 전체면적 |
| `syncStatus` | string | 콘텐츠상태, only in `basedSyncList` |

## Stage 2 sample plan

Do not run full enrichment before this sample is reviewed.

1. Add a sample-only workflow dispatch path or standalone workflow.
2. Select about 25 existing Tripview posts whose title, source title, or tags imply camping, campground, glamping, caravan, recreation forest, or beach camping.
3. Fetch GoCamping `basedList` pages and match in this order:
   - direct `contentid` to `contentId`;
   - coordinate match only if a Tripview post exposes usable coordinates;
   - text fallback using facility name plus exact city/county region confirmation.
4. For matched rows, call `imageList` by `contentId` to confirm additional image availability.
5. Log checked count, direct-id match count, text match count, coordinate candidate count, failures, region consistency, coordinate availability, and sample response examples.
6. Stop after the sample report. Full application needs a separate user instruction.
