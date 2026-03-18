package com.charging.backend.common;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class ApiResult {

    private ApiResult() {
    }

    public static Map<String, Object> success() {
        Map<String, Object> result = base(200, "操作成功");
        return result;
    }

    public static Map<String, Object> success(String message) {
        return base(200, message);
    }

    public static Map<String, Object> successData(Object data) {
        Map<String, Object> result = base(200, "操作成功");
        result.put("data", data);
        return result;
    }

    public static Map<String, Object> table(List<Map<String, Object>> rows, long total) {
        Map<String, Object> result = base(200, "查询成功");
        result.put("rows", rows);
        result.put("total", total);
        return result;
    }

    public static Map<String, Object> error(String message) {
        return base(500, message == null || message.isBlank() ? "操作失败" : message);
    }

    public static Map<String, Object> unauthorized(String message) {
        return base(401, message == null || message.isBlank() ? "未登录或登录已过期" : message);
    }

    private static Map<String, Object> base(int code, String msg) {
        Map<String, Object> result = new HashMap<>();
        result.put("code", code);
        result.put("msg", msg);
        return result;
    }
}

