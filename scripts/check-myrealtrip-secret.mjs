const key = process.env.MYREALTRIP_API_KEY || process.env.PARTNER_API_KEY || process.env.MYREALTRIP_PARTNER_API_KEY || "";
const baseUrl = process.env.MYREALTRIP_API_BASE_URL
  || process.env.MYREALTRIP_PRODUCTS_URL
  || process.env.MYREALTRIP_API_URL
  || process.env.MYREALTRIP_ENDPOINT_URL
  || process.env.PARTNER_API_URL
  || "";

if (!key.trim()) {
  throw new Error("MyRealTrip API key is not configured. Set MYREALTRIP_API_KEY or PARTNER_API_KEY.");
}

console.log(`MyRealTrip API key is configured. length=${key.length}`);

if (baseUrl.trim()) {
  console.log(`MyRealTrip API URL is configured: ${baseUrl}`);
} else {
  console.log("MyRealTrip API URL is not configured. Add it when the product endpoint is available.");
}
