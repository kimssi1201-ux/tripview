// Public crawl diagnostics. Simulated user agents do not prove Googlebot access.
// Verify genuine Googlebot with Search Console's URL Inspection and Cloudflare logs.
const base = process.env.PUBLIC_SITE_URL || "https://tripview.kr";
const paths = ["/", "/robots.txt", "/sitemap.xml", "/tools/", "/festival/"];
const agents = {
  standard: "Mozilla/5.0 (compatible; TripviewAudit/1.0)",
  simulatedGooglebot: "Googlebot/2.1 (+http://www.google.com/bot.html)",
};
let failed = false;
for (const [label, agent] of Object.entries(agents)) {
  for (const path of paths) {
    const url = new URL(path, base).toString();
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "user-agent": agent, accept: "text/html,application/xml,text/plain" },
        signal: AbortSignal.timeout(12000),
      });
      const ok = response.status >= 200 && response.status < 400;
      console.log([label, response.status, url, ok ? "OK" : "CHECK"].join(" | "));
      if (!ok) failed = true;
      await response.body?.cancel();
    } catch (error) {
      failed = true;
      console.error([label, "ERROR", url, String(error.message || error)].join(" | "));
    }
  }
}
console.log("A 403 may be due to WAF, origin rules, or crawler verification. Check Cloudflare events and Search Console before changing bot settings.");
if (failed) process.exitCode = 1;
