import { get, put } from '../common/http/request'

export function fetchStations(params = {}) {
  return get('chargingstation/chongdianzhan/list', params)
}

export function fetchStationById(id) {
  return get(`chargingstation/chongdianzhan/${id}`)
}

export function fetchStationGrades(params = {}) {
  return get('chargingstation/stationgrade/list', params)
}

export function fetchPowerList(params = {}) {
  return get('chargingstation/power/list', params)
}

export function fetchStumpList(params = {}) {
  return get('chargingstation/stump/list', params)
}

export function updateStump(data) {
  return put('chargingstation/stump', data)
}
