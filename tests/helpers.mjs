export function request(path, init = {}) {
  return new Request(`https://tripview.test${path}`, init);
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function assetStore(files) {
  return {
    async fetch(input) {
      const pathname = new URL(input.url || input).pathname;
      if (!(pathname in files)) return jsonResponse({ error: "not found" }, 404);
      return jsonResponse(files[pathname]);
    },
  };
}

export async function withMockFetch(implementation, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    return await callback();
  } finally {
    globalThis.fetch = original;
  }
}

export async function responseJson(response) {
  return response.json();
}
