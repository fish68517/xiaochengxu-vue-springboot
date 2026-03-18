package com.charging.backend.controller;

import com.charging.backend.common.ApiResult;
import com.charging.backend.support.NameUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/SC/collect")
public class CollectController {

    private final JdbcTemplate jdbcTemplate;

    public CollectController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping
    public Map<String, Object> addCollect(@RequestBody Map<String, Object> body) {
        Long userId = parseLong(body.get("userId"));
        Long stationId = parseLong(body.get("chargingstationId"));
        if (userId == null) {
            userId = parseLong(body.get("user_id"));
        }
        if (stationId == null) {
            stationId = parseLong(body.get("chargingStation_id"));
        }
        if (userId == null || stationId == null) {
            return ApiResult.error("userId or chargingstationId is empty");
        }

        List<Map<String, Object>> exists = jdbcTemplate.queryForList(
            "SELECT * FROM `collect` WHERE `user_id` = ? AND `chargingStation_id` = ? LIMIT 1",
            userId,
            stationId
        );
        if (!exists.isEmpty()) {
            return ApiResult.successData(NameUtils.decorateRow(exists.get(0)));
        }

        jdbcTemplate.update(
            "INSERT INTO `collect` (`user_id`,`chargingStation_id`,`del`) VALUES (?,?,0)",
            userId,
            stationId
        );
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM `collect` WHERE `user_id` = ? AND `chargingStation_id` = ? LIMIT 1",
            userId,
            stationId
        );
        if (rows.isEmpty()) {
            return ApiResult.success();
        }
        return ApiResult.successData(NameUtils.decorateRow(rows.get(0)));
    }

    private Long parseLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}

