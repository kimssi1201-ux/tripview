const key = process.env.MYREALTRIP_API_KEY || "";
const baseUrl = process.env.MYREALTRIP_API_BASE_URL || "";

if (!key.trim()) {
  throw new Error("MYREALTRIP_API_KEY is not configured.");
}

console.log(`MYREALTRIP_API_KEY is configured. length=${key.length}`);

if (baseUrl.trim()) {
  console.log(`MYREALTRIP_API_BASE_URL is configured: ${baseUrl}`);
} else {
  console.log("MYREALTRIP_API_BASE_URL is not configured. Add it when the API endpoint is available.");
}
