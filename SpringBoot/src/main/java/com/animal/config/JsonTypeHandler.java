package com.animal.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;

@MappedTypes(Map.class)
public class JsonTypeHandler extends BaseTypeHandler<Map<String, String>> {
    private static final Logger log = LoggerFactory.getLogger(JsonTypeHandler.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, Map<String, String> parameter, JdbcType jdbcType)
            throws SQLException {
        if (parameter == null) {
            ps.setNull(i, jdbcType.TYPE_CODE);
            return;
        }
        try {
            String json = MAPPER.writeValueAsString(parameter);
            ps.setString(i, new String(json.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new SQLException("Error converting Map to JSON", e);
        }
    }

    @Override
    public Map<String, String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        try {
            String json = rs.getString(columnName);
            if (json == null || json.trim().isEmpty()) {
                return null;
            }
            json = new String(json.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
            log.debug("Converting JSON to Map for column {}: {}", columnName, json);
            return MAPPER.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            log.error("Error converting JSON to Map for column " + columnName, e);
            log.error("Original JSON: {}", rs.getString(columnName));
            e.printStackTrace(); // 打印完整堆栈
            throw new SQLException("Error converting JSON to Map for column " + columnName + ", JSON: " + rs.getString(columnName), e);
        }
    }

    @Override
    public Map<String, String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        try {
            String json = rs.getString(columnIndex);
            if (json == null || json.trim().isEmpty()) {
                return null;
            }
            json = new String(json.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
            return MAPPER.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            throw new SQLException("Error converting JSON to Map at index " + columnIndex + ", JSON: " + rs.getString(columnIndex), e);
        }
    }

    @Override
    public Map<String, String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        try {
            String json = cs.getString(columnIndex);
            if (json == null || json.trim().isEmpty()) {
                return null;
            }
            json = new String(json.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
            return MAPPER.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            throw new SQLException("Error converting JSON to Map at index " + columnIndex + ", JSON: " + cs.getString(columnIndex), e);
        }
    }
}