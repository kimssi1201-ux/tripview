export const NAVER_FEED_TITLE_MIN_CHARS = 35;
export const NAVER_FEED_TITLE_MAX_CHARS = 70;
export const NAVER_FEED_TITLE_LEAD_CHARS = 24;

export function cleanHeadline(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function headlineLength(value = "") {
  return [...cleanHeadline(value)].length;
}

export function composeNaverFeedHeadline({
  place = "",
  hook = "",
  detail = "",
  fallbackDetail = "방문 전 체크",
} = {}) {
  const cleanPlace = cleanHeadline(place);
  const cleanHook = cleanHeadline(hook);
  const cleanDetail = cleanHeadline(detail);
  const leadHook = cleanPlace && !cleanHook.includes(cleanPlace) ? `${cleanPlace}, ${cleanHook}` : cleanHook;
  const detailText = cleanDetail || fallbackDetail;
  let title = `“${leadHook}”… ${detailText}`;
  if (headlineLength(title) < NAVER_FEED_TITLE_MIN_CHARS) {
    title = `${title}, ${fallbackDetail}`;
  }
  return cleanHeadline(title);
}

export function naverFeedTitleProfile(title = "", contextTerms = []) {
  const cleanTitle = cleanHeadline(title);
  const lead = [...cleanTitle].slice(0, NAVER_FEED_TITLE_LEAD_CHARS).join("");
  const terms = contextTerms
    .map(cleanHeadline)
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length);
  const length = headlineLength(cleanTitle);
  return {
    title: cleanTitle,
    length,
    hasReferenceHook: /^“[^”]+”…\s+/.test(cleanTitle),
    hasContextInLead: terms.some((term) => lead.includes(term)),
    withinRecommendedLength: length >= NAVER_FEED_TITLE_MIN_CHARS && length <= NAVER_FEED_TITLE_MAX_CHARS,
  };
}
