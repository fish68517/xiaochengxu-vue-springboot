package com.charging.backend.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public Map<String, Object> handleIllegalArgument(IllegalArgumentException ex) {
        return ApiResult.error(ex.getMessage());
    }

    @ExceptionHandler({DataAccessException.class, HttpMessageNotReadableException.class})
    public Map<String, Object> handleDataException(Exception ex) {
        log.warn("Request failed: {}", ex.getMessage());
        return ApiResult.error("请求参数或数据库操作异常");
    }

    @ExceptionHandler(Exception.class)
    public Map<String, Object> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ApiResult.error("服务器内部错误");
    }
}

