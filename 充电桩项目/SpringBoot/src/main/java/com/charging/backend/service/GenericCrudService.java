package com.charging.backend.service;

import com.charging.backend.support.NameUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GenericCrudService {

    private static final Set<String> RESERVED_QUERY_KEYS = Set.of("pageNum", "pageSize", "orderByColumn", "isAsc");

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;
    private final ResourceRegistry resourceRegistry;
    private final Map<String, TableMeta> tableMetaCache = new ConcurrentHashMap<>();

    public GenericCrudService(JdbcTemplate jdbcTemplate, ResourceRegistry resourceRegistry) {
        this.jdbcTemplate = jdbcTemplate;
        this.namedJdbcTemplate = new NamedParameterJdbcTemplate(jdbcTemplate);
        this.resourceRegistry = resourceRegistry;
    }

    public QueryResult list(String module, String resource, Map<String, String> requestParams) {
        TableMeta meta = resolveMeta(module, resource);
        Map<String, Object> params = new LinkedHashMap<>();
        List<String> where = new ArrayList<>();

        boolean hasDelCondition = false;
        for (Map.Entry<String, String> entry : requestParams.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (!StringUtils.hasText(key) || !StringUtils.hasText(value) || RESERVED_QUERY_KEYS.contains(key)) {
                continue;
            }
            Optional<String> columnOpt = meta.findColumn(key);
            if (columnOpt.isEmpty()) {
                continue;
            }
            String column = columnOpt.get();
            if ("del".equalsIgnoreCase(column)) {
                hasDelCondition = true;
            }
            String paramName = "p_" + params.size();
            if (isTextType(meta.columnTypes.get(column))) {
                where.add(quote(column) + " LIKE :" + paramName);
                params.put(paramName, "%" + value.trim() + "%");
            } else {
                where.add(quote(column) + " = :" + paramName);
                params.put(paramName, value.trim());
            }
        }
        if (meta.hasDelColumn && !hasDelCondition) {
            where.add(quote("del") + " = 0");
        }

        int pageNum = parsePositiveInt(requestParams.get("pageNum"), 1);
        int pageSize = parsePositiveInt(requestParams.get("pageSize"), 1000);
        if (pageSize > 5000) {
            pageSize = 5000;
        }
        int offset = (pageNum - 1) * pageSize;
        params.put("offset", offset);
        params.put("pageSize", pageSize);

        String whereSql = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        String orderSql = buildOrderSql(meta, requestParams.get("orderByColumn"), requestParams.get("isAsc"));

        String baseFromSql = " FROM " + quote(meta.tableName) + whereSql;
        String countSql = "SELECT COUNT(1)" + baseFromSql;
        String listSql = "SELECT *" + baseFromSql + orderSql + " LIMIT :offset, :pageSize";

        Long total = namedJdbcTemplate.queryForObject(countSql, params, Long.class);
        List<Map<String, Object>> rows = namedJdbcTemplate.queryForList(listSql, params);
        List<Map<String, Object>> decoratedRows = rows.stream().map(NameUtils::decorateRow).toList();
        return new QueryResult(decoratedRows, total == null ? 0L : total);
    }

    public Map<String, Object> getById(String module, String resource, String id) {
        TableMeta meta = resolveMeta(module, resource);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("id", id);

        StringBuilder sql = new StringBuilder("SELECT * FROM ")
            .append(quote(meta.tableName))
            .append(" WHERE ")
            .append(quote(meta.primaryKey))
            .append(" = :id");
        if (meta.hasDelColumn) {
            sql.append(" AND ").append(quote("del")).append(" = 0");
        }

        List<Map<String, Object>> rows = namedJdbcTemplate.queryForList(sql.toString(), params);
        if (rows.isEmpty()) {
            return null;
        }
        return NameUtils.decorateRow(rows.get(0));
    }

    public Map<String, Object> create(String module, String resource, Map<String, Object> payload) {
        TableMeta meta = resolveMeta(module, resource);
        Map<String, Object> insertData = mapToColumns(meta, payload, true);
        if (meta.hasDelColumn && !insertData.containsKey("del")) {
            insertData.put("del", 0);
        }
        if (insertData.isEmpty()) {
            throw new IllegalArgumentException("新增参数为空");
        }

        List<String> columns = new ArrayList<>(insertData.keySet());
        String sql = "INSERT INTO " + quote(meta.tableName) + " ("
            + columns.stream().map(this::quote).reduce((a, b) -> a + "," + b).orElse("")
            + ") VALUES ("
            + columns.stream().map(c -> ":" + c).reduce((a, b) -> a + "," + b).orElse("")
            + ")";

        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbcTemplate.update(sql, new MapSqlParameterSource(insertData), keyHolder, new String[]{meta.primaryKey});

        Object idValue = null;
        if (keyHolder.getKeys() != null) {
            idValue = keyHolder.getKeys().get(meta.primaryKey);
        }
        if (idValue == null && keyHolder.getKey() != null) {
            idValue = keyHolder.getKey();
        }
        if (idValue == null) {
            idValue = insertData.get(meta.primaryKey);
        }
        if (idValue != null) {
            Map<String, Object> row = getById(module, resource, String.valueOf(idValue));
            if (row != null) {
                return row;
            }
        }
        return NameUtils.decorateRow(insertData);
    }

    public Map<String, Object> update(String module, String resource, String pathId, Map<String, Object> payload) {
        TableMeta meta = resolveMeta(module, resource);
        String id = StringUtils.hasText(pathId) ? pathId : extractId(meta, payload);
        MatchColumn matchColumn = null;
        if (!StringUtils.hasText(id)) {
            matchColumn = extractMatchColumn(meta, payload);
            if (matchColumn == null) {
                throw new IllegalArgumentException("缺少主键参数");
            }
        }

        Map<String, Object> updateData = mapToColumns(meta, payload, true);
        updateData.remove(meta.primaryKey);
        if (matchColumn != null) {
            updateData.remove(matchColumn.column);
        }
        if (updateData.isEmpty()) {
            if (StringUtils.hasText(id)) {
                return getById(module, resource, id);
            }
            return findByColumn(meta, matchColumn.column, matchColumn.value);
        }

        List<String> sets = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : updateData.entrySet()) {
            String column = entry.getKey();
            String paramName = "u_" + sets.size();
            sets.add(quote(column) + " = :" + paramName);
            params.put(paramName, entry.getValue());
        }
        params.put("pk", id);

        StringBuilder sql = new StringBuilder("UPDATE ")
            .append(quote(meta.tableName))
            .append(" SET ")
            .append(String.join(", ", sets));
        if (StringUtils.hasText(id)) {
            params.put("pk", id);
            sql.append(" WHERE ")
                .append(quote(meta.primaryKey))
                .append(" = :pk");
        } else {
            params.put("matchValue", matchColumn.value);
            sql.append(" WHERE ")
                .append(quote(matchColumn.column))
                .append(" = :matchValue");
        }
        if (meta.hasDelColumn && !updateData.containsKey("del")) {
            sql.append(" AND ").append(quote("del")).append(" = 0");
        }

        namedJdbcTemplate.update(sql.toString(), params);
        if (StringUtils.hasText(id)) {
            return getById(module, resource, id);
        }
        return findByColumn(meta, matchColumn.column, matchColumn.value);
    }

    public int delete(String module, String resource, String ids) {
        TableMeta meta = resolveMeta(module, resource);
        List<String> idList = parseIds(ids);
        if (idList.isEmpty()) {
            throw new IllegalArgumentException("删除参数为空");
        }
        Map<String, Object> params = Collections.singletonMap("ids", idList);
        if (meta.hasDelColumn) {
            String sql = "UPDATE " + quote(meta.tableName) + " SET " + quote("del") + " = 1 WHERE "
                + quote(meta.primaryKey) + " IN (:ids)";
            return namedJdbcTemplate.update(sql, params);
        }
        String sql = "DELETE FROM " + quote(meta.tableName) + " WHERE " + quote(meta.primaryKey) + " IN (:ids)";
        return namedJdbcTemplate.update(sql, params);
    }

    private TableMeta resolveMeta(String module, String resource) {
        String table = resourceRegistry.resolveTable(module, resource)
            .orElseThrow(() -> new IllegalArgumentException("未注册的业务路由: " + module + "/" + resource));
        return tableMetaCache.computeIfAbsent(table, this::loadTableMeta);
    }

    private TableMeta loadTableMeta(String tableName) {
        DataSource dataSource = jdbcTemplate.getDataSource();
        if (dataSource == null) {
            throw new IllegalStateException("数据库连接未配置");
        }

        Map<String, Integer> columnTypes = new LinkedHashMap<>();
        String pk = null;
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            try (ResultSet rs = metaData.getColumns(connection.getCatalog(), null, tableName, "%")) {
                while (rs.next()) {
                    String columnName = rs.getString("COLUMN_NAME");
                    int dataType = rs.getInt("DATA_TYPE");
                    columnTypes.put(columnName, dataType);
                }
            }
            if (columnTypes.isEmpty()) {
                try (ResultSet rs = metaData.getColumns(connection.getCatalog(), null, tableName.toUpperCase(Locale.ROOT), "%")) {
                    while (rs.next()) {
                        String columnName = rs.getString("COLUMN_NAME");
                        int dataType = rs.getInt("DATA_TYPE");
                        columnTypes.put(columnName, dataType);
                    }
                }
            }
            try (ResultSet pkRs = metaData.getPrimaryKeys(connection.getCatalog(), null, tableName)) {
                if (pkRs.next()) {
                    pk = pkRs.getString("COLUMN_NAME");
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("读取表结构失败: " + tableName, e);
        }

        if (columnTypes.isEmpty()) {
            throw new IllegalArgumentException("数据库中不存在表: " + tableName);
        }
        if (!StringUtils.hasText(pk)) {
            pk = columnTypes.containsKey("id") ? "id" : columnTypes.keySet().iterator().next();
        }
        return new TableMeta(tableName, pk, columnTypes);
    }

    private String buildOrderSql(TableMeta meta, String orderByColumn, String isAsc) {
        String column = meta.findColumn(orderByColumn).orElse(meta.primaryKey);
        String direction = "DESC";
        if (StringUtils.hasText(isAsc) && "asc".equalsIgnoreCase(isAsc.trim())) {
            direction = "ASC";
        }
        return " ORDER BY " + quote(column) + " " + direction;
    }

    private Map<String, Object> mapToColumns(TableMeta meta, Map<String, Object> payload, boolean allowPrimaryKey) {
        Map<String, Object> source = payload == null ? Collections.emptyMap() : payload;
        Map<String, Object> mapped = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            String key = entry.getKey();
            if (!StringUtils.hasText(key)) {
                continue;
            }
            Optional<String> columnOpt = meta.findColumn(key);
            if (columnOpt.isEmpty()) {
                continue;
            }
            String column = columnOpt.get();
            if (!allowPrimaryKey && meta.primaryKey.equalsIgnoreCase(column)) {
                continue;
            }
            Object value = entry.getValue();
            if (value instanceof String s && !StringUtils.hasText(s)) {
                value = null;
            }
            mapped.putIfAbsent(column, value);
        }
        return mapped;
    }

    private String extractId(TableMeta meta, Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            Optional<String> column = meta.findColumn(entry.getKey());
            if (column.isPresent() && Objects.equals(column.get(), meta.primaryKey)) {
                Object value = entry.getValue();
                return value == null ? null : String.valueOf(value);
            }
        }
        return null;
    }

    private MatchColumn extractMatchColumn(TableMeta meta, Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        String[] candidates = {"userId", "user_id", "phoneNum", "email"};
        for (String key : candidates) {
            Object value = payload.get(key);
            if (value == null || (value instanceof String s && !StringUtils.hasText(s))) {
                continue;
            }
            Optional<String> column = meta.findColumn(key);
            if (column.isPresent()) {
                return new MatchColumn(column.get(), value);
            }
        }
        return null;
    }

    private Map<String, Object> findByColumn(TableMeta meta, String column, Object value) {
        if (!StringUtils.hasText(column) || value == null) {
            return null;
        }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("value", value);
        StringBuilder sql = new StringBuilder("SELECT * FROM ")
            .append(quote(meta.tableName))
            .append(" WHERE ")
            .append(quote(column))
            .append(" = :value");
        if (meta.hasDelColumn) {
            sql.append(" AND ").append(quote("del")).append(" = 0");
        }
        sql.append(" ORDER BY ").append(quote(meta.primaryKey)).append(" DESC LIMIT 1");
        List<Map<String, Object>> rows = namedJdbcTemplate.queryForList(sql.toString(), params);
        if (rows.isEmpty()) {
            return null;
        }
        return NameUtils.decorateRow(rows.get(0));
    }

    private int parsePositiveInt(String value, int defaultValue) {
        if (!StringUtils.hasText(value)) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(value.trim());
            return parsed > 0 ? parsed : defaultValue;
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private List<String> parseIds(String ids) {
        if (!StringUtils.hasText(ids)) {
            return Collections.emptyList();
        }
        String[] parts = ids.split(",");
        List<String> values = new ArrayList<>();
        for (String part : parts) {
            if (StringUtils.hasText(part)) {
                values.add(part.trim());
            }
        }
        return values;
    }

    private boolean isTextType(Integer type) {
        if (type == null) {
            return true;
        }
        return switch (type) {
            case Types.VARCHAR, Types.CHAR, Types.LONGVARCHAR, Types.NVARCHAR, Types.NCHAR, Types.LONGNVARCHAR -> true;
            default -> false;
        };
    }

    private String quote(String identifier) {
        return "`" + identifier.replace("`", "") + "`";
    }

    public record QueryResult(List<Map<String, Object>> rows, long total) {
    }

    private record MatchColumn(String column, Object value) {
    }

    private static class TableMeta {
        private final String tableName;
        private final String primaryKey;
        private final Map<String, Integer> columnTypes;
        private final Map<String, String> canonicalToColumn;
        private final boolean hasDelColumn;

        private TableMeta(String tableName, String primaryKey, Map<String, Integer> columnTypes) {
            this.tableName = tableName;
            this.primaryKey = primaryKey;
            this.columnTypes = columnTypes;
            this.canonicalToColumn = new LinkedHashMap<>();
            for (String column : columnTypes.keySet()) {
                this.canonicalToColumn.putIfAbsent(NameUtils.canonical(column), column);
                this.canonicalToColumn.putIfAbsent(NameUtils.canonical(NameUtils.snakeToCamelKeepFirst(column)), column);
                this.canonicalToColumn.putIfAbsent(NameUtils.canonical(NameUtils.snakeToCamelLowerFirst(column)), column);
            }
            this.hasDelColumn = columnTypes.containsKey("del");
        }

        private Optional<String> findColumn(String incomingKey) {
            if (!StringUtils.hasText(incomingKey)) {
                return Optional.empty();
            }
            if (columnTypes.containsKey(incomingKey)) {
                return Optional.of(incomingKey);
            }
            return Optional.ofNullable(canonicalToColumn.get(NameUtils.canonical(incomingKey)));
        }
    }
}
