export const pickPayload = (response) => {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data
  }
  return response || {}
}

export const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export const toMap = (payload) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
      return payload.data
    }
    return payload
  }
  return {}
}

export const toBool = (payload) => {
  if (typeof payload === 'boolean') return payload
  if (typeof payload?.data === 'boolean') return payload.data
  return false
}
