/**
 * Affiliate offer visibility is disabled while tripview.kr is reviewed.
 * To restore offers later, explicitly build with TRIPVIEW_AFFILIATE_ENABLED=1.
 * This controls rendered HTML, not just a CSS hide, and does not delete data.
 */
export const AFFILIATE_DISPLAY_ENABLED = process.env.TRIPVIEW_AFFILIATE_ENABLED === "1";
