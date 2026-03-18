package com.charging.backend.support;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public final class NameUtils {

    private NameUtils() {
    }

    public static String canonical(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("_", "").replace("-", "").toLowerCase(Locale.ROOT);
    }

    public static String snakeToCamelKeepFirst(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String[] parts = value.split("_");
        if (parts.length == 1) {
            return value;
        }
        StringBuilder sb = new StringBuilder(parts[0]);
        for (int i = 1; i < parts.length; i++) {
            if (parts[i].isEmpty()) {
                continue;
            }
            sb.append(Character.toUpperCase(parts[i].charAt(0)));
            if (parts[i].length() > 1) {
                sb.append(parts[i].substring(1));
            }
        }
        return sb.toString();
    }

    public static String snakeToCamelLowerFirst(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String[] parts = value.split("_");
        if (parts.length == 1) {
            return Character.toLowerCase(value.charAt(0)) + value.substring(1);
        }
        StringBuilder sb = new StringBuilder(parts[0].toLowerCase(Locale.ROOT));
        for (int i = 1; i < parts.length; i++) {
            if (parts[i].isEmpty()) {
                continue;
            }
            String part = parts[i].toLowerCase(Locale.ROOT);
            sb.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                sb.append(part.substring(1));
            }
        }
        return sb.toString();
    }

    public static String camelToSnakeLower(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isUpperCase(c) && i > 0) {
                result.append('_');
            }
            result.append(Character.toLowerCase(c));
        }
        return result.toString();
    }

    public static Map<String, Object> decorateRow(Map<String, Object> row) {
        Map<String, Object> decorated = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String key = entry.getKey();
            Object val = entry.getValue();
            putIfAbsent(decorated, key, val);

            String camel1 = snakeToCamelKeepFirst(key);
            String camel2 = snakeToCamelLowerFirst(key);
            String snake = camelToSnakeLower(key);

            putIfAbsent(decorated, camel1, val);
            putIfAbsent(decorated, camel2, val);
            putIfAbsent(decorated, snake, val);

            if (camel1 != null && camel1.endsWith("Id") && camel1.length() > 2) {
                putIfAbsent(decorated, camel1.substring(0, camel1.length() - 2).toLowerCase(Locale.ROOT) + "Id", val);
            }
            if (camel2 != null && camel2.endsWith("Id") && camel2.length() > 2) {
                putIfAbsent(decorated, camel2.substring(0, camel2.length() - 2).toLowerCase(Locale.ROOT) + "Id", val);
            }
        }
        return decorated;
    }

    private static void putIfAbsent(Map<String, Object> target, String key, Object value) {
        if (key == null || key.isBlank()) {
            return;
        }
        target.putIfAbsent(key, value);
    }
}

