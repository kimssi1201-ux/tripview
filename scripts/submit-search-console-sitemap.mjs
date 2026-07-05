import crypto from "node:crypto";
import { promises as fs } from "node:fs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SITEMAP_SCOPE = "https://www.googleapis.com/auth/webmasters";
const DEFAULT_SITE_URL = "sc-domain:tripview.kr";
const DEFAULT_SITEMAP_URL = "https://tripview.kr/sitemap.xml";

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function encodePathSegment(value) {
  return encodeURIComponent(value);
}

async function readServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const rawBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64?.trim();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (rawJson) return JSON.parse(rawJson);
  if (rawBase64) return JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
  if (credentialsPath) return JSON.parse(await fs.readFile(credentialsPath, "utf8"));

  return null;
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = serviceAccount.private_key?.replace(/\\n/g, "\n");
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: SITEMAP_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey);
  const assertion = `${signingInput}.${base64Url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Google OAuth failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}

async function submitSitemap(accessToken, siteUrl, sitemapUrl) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodePathSegment(siteUrl)}/sitemaps/${encodePathSegment(sitemapUrl)}`;
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Search Console sitemap submit failed: ${response.status} ${body}`);
  }
}

const serviceAccount = await readServiceAccount();
if (!serviceAccount) {
  console.log("Search Console sitemap submit skipped: GOOGLE_SERVICE_ACCOUNT_JSON is not configured.");
  process.exit(0);
}

const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL || DEFAULT_SITE_URL;
const sitemapUrl = process.env.SEARCH_CONSOLE_SITEMAP_URL || DEFAULT_SITEMAP_URL;

const token = await getAccessToken(serviceAccount);
await submitSitemap(token, siteUrl, sitemapUrl);
console.log(`Submitted sitemap to Google Search Console: ${sitemapUrl} (${siteUrl})`);
