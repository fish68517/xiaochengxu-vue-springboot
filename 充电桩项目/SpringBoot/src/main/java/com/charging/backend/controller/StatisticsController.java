package com.charging.backend.controller;

import com.charging.backend.common.ApiResult;
import com.charging.backend.support.NameUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class StatisticsController {

    private final JdbcTemplate jdbcTemplate;

    public StatisticsController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/system/home/stats")
    public Map<String, Object> homeStats() {
        long stationCount = count("SELECT COUNT(1) FROM `chargingstation`");
        long userCount = count("SELECT COUNT(1) FROM `user` WHERE (`del` = 0 OR `del` IS NULL)");
        long orderCount = count("SELECT COUNT(1) FROM `order` WHERE (`del` = 0 OR `del` IS NULL)");
        long activeStump = count("SELECT COUNT(1) FROM `stump` WHERE `occupy` = 1");
        return ApiResult.successData(Map.of(
            "stationCount", stationCount,
            "userCount", userCount,
            "orderCount", orderCount,
            "activeStump", activeStump
        ));
    }

    @GetMapping("/system/charger/realtime")
    public Map<String, Object> realtime() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT `id`,`chargingStationID`,`stumpID`,`state`,`createTime`,`orderPrice` "
                + "FROM `order` ORDER BY `id` DESC LIMIT 20"
        );
        return ApiResult.successData(rows.stream().map(NameUtils::decorateRow).toList());
    }

    @GetMapping("/system/charger/history")
    public Map<String, Object> history() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT `id`,`chargingStationID`,`stumpID`,`state`,`createTime`,`orderPrice`,`chargingTime` "
                + "FROM `order` ORDER BY `id` DESC LIMIT 50"
        );
        return ApiResult.successData(rows.stream().map(NameUtils::decorateRow).toList());
    }

    @GetMapping("/charger/statistics/trend")
    public Map<String, Object> trend() {
        List<Map<String, Object>> rows = List.of(
            Map.of("label", "周一", "fast", 120, "slow", 80),
            Map.of("label", "周二", "fast", 150, "slow", 90),
            Map.of("label", "周三", "fast", 130, "slow", 95),
            Map.of("label", "周四", "fast", 165, "slow", 110),
            Map.of("label", "周五", "fast", 180, "slow", 120)
        );
        return ApiResult.successData(rows);
    }

    @GetMapping("/charger/statistics/types")
    public Map<String, Object> types() {
        return ApiResult.successData(List.of(
            Map.of("name", "快充", "value", 62),
            Map.of("name", "慢充", "value", 38)
        ));
    }

    @GetMapping("/charger/statistics/stations")
    public Map<String, Object> stations() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT `id`,`stationName`,`stumpNum` FROM `chargingstation` ORDER BY `id` ASC LIMIT 10"
        );
        return ApiResult.successData(rows.stream().map(NameUtils::decorateRow).toList());
    }

    @GetMapping("/charger/statistics/monitor")
    public Map<String, Object> monitor() {
        return ApiResult.successData(List.of(
            Map.of("time", "00:00", "voltage", 220, "current", 148, "power", 32),
            Map.of("time", "06:00", "voltage", 223, "current", 152, "power", 34),
            Map.of("time", "12:00", "voltage", 227, "current", 160, "power", 36),
            Map.of("time", "18:00", "voltage", 225, "current", 157, "power", 35),
            Map.of("time", "24:00", "voltage", 221, "current", 150, "power", 33)
        ));
    }

    private long count(String sql) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }
}

