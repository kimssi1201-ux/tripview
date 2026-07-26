// Backward-compatible endpoint. Beach pages now use the Ministry of Oceans
// beach information API only; this old URL must not reintroduce weather data.
export { onRequestGet } from "./beach-info.js";
