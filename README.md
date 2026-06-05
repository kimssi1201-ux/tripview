# 여행노트

국내외 여행 정보, 숙소 비교, 항공권과 액티비티 예약 팁을 정리한 한국어 여행 매거진 정적 사이트입니다.

## 주요 기능

- 대표 여행 카드와 오른쪽 추천 글 목록
- 카테고리 pill 필터와 검색 UI
- 최신 여행 이야기 3열 카드 목록
- 인기 여행지와 예약 서비스 카드
- 개인정보 처리방침, manifest, robots, sitemap 포함

## 파일 구조

- `index.html` - 메인 페이지
- `style.css` / `styles.css` - 사이트 스타일
- `main.js` - 카테고리 필터, 검색, 더보기 동작
- `privacy.html` - 개인정보 처리방침
- `scripts/build-www.mjs` - `www/`, `site/` 배포 폴더 생성

## 배포

정적 호스팅에는 루트 파일을 그대로 올리거나, 아래 명령으로 생성되는 `www/` 또는 `site/` 폴더를 사용할 수 있습니다.

```bash
npm run build
```
