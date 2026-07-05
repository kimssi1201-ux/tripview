export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.pathname = "/site/sitemap.xml";
  url.search = "";

  const assetRequest = new Request(url.toString(), context.request);
  const response = context.env?.ASSETS
    ? await context.env.ASSETS.fetch(assetRequest)
    : await fetch(assetRequest);

  const headers = new Headers(response.headers);
  headers.set("content-type", "application/xml; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, must-revalidate");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
