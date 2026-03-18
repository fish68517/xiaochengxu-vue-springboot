import { get } from '../common/http/request'

export function fetchCarInfoList(params = {}) {
  return get('car/carinfo/list', params)
}

export function fetchCarInfoById(id) {
  return get(`car/carinfo/${id}`)
}

export function fetchCarModelList(params = {}) {
  return get('car/carmodel/list', params)
}
