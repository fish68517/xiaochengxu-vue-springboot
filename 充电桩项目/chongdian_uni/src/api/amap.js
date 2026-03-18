import { AMAP_WEB_SERVICE_KEY } from "../common/config"

const AMAP_BASE = "https://restapi.amap.com/v3"

function amapRequest(path, data = {}) {
  return new Promise((resolve, reject) => {
    if (!AMAP_WEB_SERVICE_KEY) {
      reject(new Error("missing_amap_web_service_key"))
      return
    }

    uni.request({
      url: `${AMAP_BASE}${path}`,
      method: "GET",
      data: {
        key: AMAP_WEB_SERVICE_KEY,
        ...data
      },
      success: (res) => {
        const payload = res.data || {}
        if (payload.status === "1") {
          resolve(payload)
          return
        }
        reject(new Error(payload.info || payload.infocode || "amap_request_failed"))
      },
      fail: (err) => {
        reject(new Error(err.errMsg || "amap_network_error"))
      }
    })
  })
}

function parseRectangleCenter(rectangle) {
  if (!rectangle || typeof rectangle !== "string") return null
  const pair = rectangle.split(";")
  if (pair.length !== 2) return null
  const [lng1, lat1] = (pair[0] || "").split(",").map(Number)
  const [lng2, lat2] = (pair[1] || "").split(",").map(Number)
  if (![lng1, lat1, lng2, lat2].every((n) => Number.isFinite(n))) return null
  return {
    longitude: (lng1 + lng2) / 2,
    latitude: (lat1 + lat2) / 2
  }
}

export async function amapIpLocate() {
  const payload = await amapRequest("/ip")
  const center = parseRectangleCenter(payload.rectangle)
  if (!center) throw new Error("amap_ip_invalid_rectangle")
  return {
    ...center,
    province: payload.province || "",
    city: payload.city || ""
  }
}

export async function amapReverseGeocode(longitude, latitude) {
  const payload = await amapRequest("/geocode/regeo", {
    location: `${longitude},${latitude}`,
    extensions: "base",
    batch: false
  })
  const regeo = payload.regeocode || {}
  return {
    formattedAddress: regeo.formatted_address || "",
    addressComponent: regeo.addressComponent || {}
  }
}
