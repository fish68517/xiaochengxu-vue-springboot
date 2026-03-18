const isMpWeixin = process.env.UNI_PLATFORM === "mp-weixin"
const h5Host = typeof window !== "undefined" && window.location ? window.location.hostname : "127.0.0.1"

const customApiBase = typeof uni !== "undefined" ? uni.getStorageSync("apiBaseUrl") : ""

// JS API key: used by uni-app H5 <map> via src/manifest.json.
// Keeping it here only for debugging display.
const customAmapJsKey = typeof uni !== "undefined" ? uni.getStorageSync("amapJsKey") : ""

// Web service key: used by /v3/ip and /v3/geocode/regeo requests.
const customAmapWebServiceKey =
  typeof uni !== "undefined" ? uni.getStorageSync("amapWebServiceKey") || uni.getStorageSync("amapWebKey") : ""

export const API_BASE_URL =
  customApiBase || (isMpWeixin ? "http://127.0.0.1:8080" : `http://${h5Host}:8080`)

export const TOKEN_KEY = "token"
export const USER_KEY = "wxuser"

// If you modify manifest h5.sdkConfigs.maps.amap.key, keep this in sync for debugging display only.
export const AMAP_JS_KEY = customAmapJsKey || "5f536a72b3554c7fee621bd5ed10bd80"

// IMPORTANT: set this to a "Web Service" key from AMap console.
// Do not use JS key here, otherwise REST calls return USERKEY_PLAT_NOMATCH.
export const AMAP_WEB_SERVICE_KEY = customAmapWebServiceKey || ""

// Backward-compatible alias.
export const AMAP_WEB_KEY = AMAP_WEB_SERVICE_KEY
