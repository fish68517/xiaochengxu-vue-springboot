package com.charging.backend.controller;

import com.charging.backend.common.ApiResult;
import com.charging.backend.support.NameUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/chargingstation")
public class ChargingStationExtraController {

    private final JdbcTemplate jdbcTemplate;

    public ChargingStationExtraController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/chongdianzhan/getOpeningTimesByStationId/{stationId}")
    public Map<String, Object> getOpeningTimesByStationId(@PathVariable("stationId") Long stationId) {
        List<Map<String, Object>> rows = safeQueryForList(
            "SELECT o.* FROM `chargingstation_opentime` co "
                + "LEFT JOIN `opentime` o ON co.`openTime_id` = o.`id` "
                + "WHERE co.`chargingStation_id` = ?",
            stationId
        );
        return ApiResult.successData(rows.stream().map(NameUtils::decorateRow).toList());
    }

    @GetMapping("/chongdianzhan/selectServicesByStationId/{stationId}")
    public Map<String, Object> selectServicesByStationId(@PathVariable("stationId") Long stationId) {
        List<Map<String, Object>> rows = safeQueryForList(
            "SELECT * FROM `stationservice` WHERE `chargingStation_id` = ?",
            stationId
        );
        if (rows.isEmpty()) {
            rows = safeQueryForList(
                "SELECT ss.* FROM `chargingstation_stationservice` css "
                    + "LEFT JOIN `stationservice` ss ON css.`stationService_id` = ss.`id` "
                    + "WHERE css.`chargingStation_id` = ?",
                stationId
            );
        }
        if (rows.isEmpty()) {
            rows = safeQueryForList(
                "SELECT ss.* FROM `chargingstationservice` css "
                    + "LEFT JOIN `stationservice` ss ON css.`serviceID` = ss.`id` "
                    + "WHERE css.`chargingstationID` = ?",
                stationId
            );
        }
        return ApiResult.successData(rows.stream().map(NameUtils::decorateRow).toList());
    }

    @GetMapping("/stationgrade/getStationgradeByStationId/{stationId}")
    public Map<String, Object> getStationgradeByStationId(@PathVariable("stationId") Long stationId) {
        List<Map<String, Object>> rows = safeQueryForList(
            "SELECT sg.*, u.`name` FROM `stationgrade` sg "
                + "LEFT JOIN `user` u ON sg.`user_id` = u.`id` "
                + "WHERE sg.`chargingStation_id` = ? "
                + "ORDER BY sg.`id` DESC",
            stationId
        );
        return ApiResult.successData(rows.stream().map(NameUtils::decorateRow).toList());
    }

    @GetMapping("/stump/countByChargingstationId/{chargingstationId}")
    public Map<String, Object> countByChargingstationId(@PathVariable("chargingstationId") Long chargingstationId) {
        Long count = safeQueryForLong(
            "SELECT COUNT(1) FROM `stump` WHERE `chargingStation_id` = ?",
            chargingstationId
        );
        if (count == null) {
            count = safeQueryForLong(
                "SELECT COUNT(1) FROM `stump` WHERE `chargingstationId` = ?",
                chargingstationId
            );
        }
        return ApiResult.successData(count == null ? 0 : count);
    }

    private List<Map<String, Object>> safeQueryForList(String sql, Object... args) {
        try {
            return jdbcTemplate.queryForList(sql, args);
        } catch (Exception ex) {
            return Collections.emptyList();
        }
    }

    private Long safeQueryForLong(String sql, Object... args) {
        try {
            return jdbcTemplate.queryForObject(sql, Long.class, args);
        } catch (Exception ex) {
            return null;
        }
    }
}

