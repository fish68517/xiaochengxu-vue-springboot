"use strict";
const common_http_request = require("../common/http/request.js");
function fetchStations(params = {}) {
  return common_http_request.get("chargingstation/chongdianzhan/list", params);
}
function fetchStationGrades(params = {}) {
  return common_http_request.get("chargingstation/stationgrade/list", params);
}
exports.fetchStationGrades = fetchStationGrades;
exports.fetchStations = fetchStations;
