package com.charging.backend.controller;

import com.charging.backend.common.ApiResult;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/mamber/record")
public class MemberRecordController {

    private final JdbcTemplate jdbcTemplate;

    public MemberRecordController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/recharge")
    public Map<String, Object> recharge(@RequestBody Map<String, Object> body) {
        Long userId = getLong(body, "userId", "id");
        BigDecimal amount = getDecimal(body, "rechargeMoney", "amount");
        if (userId == null || amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ApiResult.error("参数不正确");
        }
        int rows = jdbcTemplate.update(
            "UPDATE `user` SET `money` = IFNULL(`money`,0) + ? WHERE `id` = ? AND (`del` = 0 OR `del` IS NULL)",
            amount,
            userId
        );
        if (rows <= 0) {
            return ApiResult.error("用户不存在");
        }
        BigDecimal money = jdbcTemplate.queryForObject("SELECT `money` FROM `user` WHERE `id` = ?", BigDecimal.class, userId);
        return ApiResult.successData(Map.of("userId", userId, "money", money == null ? BigDecimal.ZERO : money));
    }

    @PostMapping("/expense")
    public Map<String, Object> expense(@RequestBody Map<String, Object> body) {
        Long userId = getLong(body, "userId", "id");
        BigDecimal amount = getDecimal(body, "payAmount", "amount", "orderPrice");
        if (userId == null || amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ApiResult.error("参数不正确");
        }
        int rows = jdbcTemplate.update(
            "UPDATE `user` SET `money` = CASE WHEN IFNULL(`money`,0) >= ? THEN IFNULL(`money`,0) - ? ELSE 0 END "
                + "WHERE `id` = ? AND (`del` = 0 OR `del` IS NULL)",
            amount,
            amount,
            userId
        );
        if (rows <= 0) {
            return ApiResult.error("用户不存在");
        }
        BigDecimal money = jdbcTemplate.queryForObject("SELECT `money` FROM `user` WHERE `id` = ?", BigDecimal.class, userId);
        return ApiResult.successData(Map.of("userId", userId, "money", money == null ? BigDecimal.ZERO : money));
    }

    private Long getLong(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value == null) {
                continue;
            }
            if (value instanceof Number n) {
                return n.longValue();
            }
            String text = String.valueOf(value);
            if (!StringUtils.hasText(text)) {
                continue;
            }
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private BigDecimal getDecimal(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value == null) {
                continue;
            }
            if (value instanceof Number n) {
                return BigDecimal.valueOf(n.doubleValue());
            }
            String text = String.valueOf(value);
            if (!StringUtils.hasText(text)) {
                continue;
            }
            try {
                return new BigDecimal(text);
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }
}

