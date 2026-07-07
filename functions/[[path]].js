function pathParts(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split("/")
    .filter(Boolean);
}

function assetRequest(context, pathname) {
  const url = new URL(context.request.url);
  url.pathname = pathname;
  return new Request(url.toString(), context.request);
}

function articleAssetPath(parts) {
  if (parts.length === 1 && /^(travel|festival)-\d+$/.test(parts[0])) {
    return `/site/${parts[0]}/`;
  }

  if (parts[0] === "flight-deals" && parts.length >= 1) {
    return `/site/${parts.join("/")}/`;
  }

  return "";
}

export async function onRequest(context) {
  if (!["GET", "HEAD"].includes(context.request.method)) {
    return context.env.ASSETS.fetch(context.request);
  }

  const target = articleAssetPath(pathParts(context.params.path));
  if (target) {
    return context.env.ASSETS.fetch(assetRequest(context, target));
  }

  return context.env.ASSETS.fetch(context.request);
}
