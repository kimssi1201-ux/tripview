# 트립뷰 하루 1개 예약 발행

## 운영 방식
- 한국시간 매일 오전 9시에 GitHub Actions 'Daily reviewed travel publication' 실행 (UTC cron 0 0 * * *). GitHub Actions 실행 및 Cloudflare 배포는 지연될 수 있으므로 정확히 09:00:00 공개는 보장되지 않습니다.
- 대기 글은 data/scheduled-posts.json에만 저장합니다. 대기 중에는 홈페이지·RSS·사이트맵에 노출되지 않습니다.
- 현재 예약 글은 0개이며, 승인된 글이 등록되면 한국 날짜 기준 하루 최대 1개만 공개됩니다.
- 검수 미완료, 중복 글, 발행 날짜 미도래, 1,500자 미만의 본문, 확인할 수 없는 썸네일은 발행하지 않습니다.
- 발행한 글은 data/manual-posts-scheduled.json에 보관하고 data/scheduled-publication-log.json에 발행 날짜를 기록합니다. 같은 날짜 재실행 시 두 번째 글은 발행하지 않습니다.
- 빌드·테스트를 통과한 변경이 main에 커밋되면 Cloudflare Pages 배포가 트리거됩니다.

## 아이폰에서 예약 글 등록
1. GitHub의 kimssi1201-ux/tripview 저장소를 열고 data/scheduled-posts.json을 선택합니다.
2. 연필(Edit) 버튼으로 posts 배열에 완성된 여행글을 추가합니다. 이미 발행된 기록은 삭제하지 않습니다.
3. publishDate를 한국 날짜 YYYY-MM-DD로 설정합니다. 본문과 출처를 확인한 경우에만 approved를 true로 설정합니다.
4. 실제 교통·운영·주차·방문 정보 중심으로 1,500자 이상의 충분한 본문을 작성하고, 정확한 editorialReviewedAt 및 editorialReviewer를 입력합니다.
5. 사진은 /assets/processed/원본.webp 같은 로컬 이미지를 추천합니다. 실제 파일이 있어야 하며, 외부 HTTPS 이미지는 발행 시 HTTP 응답과 이미지 유형 검사를 통과해야 합니다.
6. Commit changes로 저장하면 예약일에 자동 공개됩니다.

예약 형식 (아래는 **미승인·미완성 예시**로 그대로 발행할 수 없습니다):

~~~json
{
  "timezone": "Asia/Seoul",
  "posts": [
    {
      "publishDate": "2026-10-27",
      "approved": false,
      "post": {
        "slug": "travel-example-2026",
        "title": "방문 전 확인하는 여행 가이드",
        "category": "국내여행",
        "region": "강원",
        "image": "/assets/processed/my-original-travel-photo.webp",
        "alt": "실제 장소 사진 설명",
        "description": "방문 장소 및 확인 사항",
        "excerpt": "이동·주차·운영 등 핵심 정보",
        "sections": [
          ["위치와 이동", ["공식 정보를 바탕으로 위치·교통을 구체적으로 서술합니다."]],
          ["운영과 이용 조건", ["운영 시간·요금·휴무·방문 준비를 확인해 서술합니다."]]
        ],
        "editorialStatus": "reviewed",
        "editorialReviewer": "트립뷰 편집팀",
        "editorialReviewedAt": "2026-10-26"
      }
    }
  ]
}
~~~

## 기존 자동화
- 'Manual Tour Drafts'의 정기 실행을 중지하고 수동 실행 생성량을 1개로 제한했습니다.
- 'Data post pipeline'의 정기 실행을 중지했습니다. 수동 실행은 별도의 기존 기능이므로 임의 실행하지 마세요.
- 이전 수동 일괄 발행용 'Post 10 Tour Posts Now'를 실행하면 별도로 다수 발행될 수 있으므로 하루 1개 정책을 유지하려면 사용하지 않습니다.
- 상품 데이터 동기화는 여행글 예약 공개와 별개의 기능입니다.

## 상태 확인
GitHub 저장소 → Actions → Daily reviewed travel publication에서 기록을 확인합니다. 예약 글이 없을 때는 '발행할 글 없음'으로 정상 종료됩니다. Run workflow 수동 실행에도 승인·썸네일·하루 1개 제한은 그대로 적용됩니다.
