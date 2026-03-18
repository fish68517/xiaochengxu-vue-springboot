package com.charging.backend.service.impl;

import com.charging.backend.service.TokenService;
import com.charging.backend.support.AuthSession;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InMemoryTokenService implements TokenService {

    private final Map<String, AuthSession> tokenStore = new ConcurrentHashMap<>();

    @Override
    public String createAdminToken(String userName) {
        String token = UUID.randomUUID().toString().replace("-", "");
        tokenStore.put(token, new AuthSession(1L, userName, true, null));
        return token;
    }

    @Override
    public String createWxToken(Map<String, Object> wxUser) {
        String token = UUID.randomUUID().toString().replace("-", "");
        Long userId = null;
        Object id = wxUser.get("id");
        if (id instanceof Number n) {
            userId = n.longValue();
        }
        String name = wxUser.get("name") == null ? "wx-user" : String.valueOf(wxUser.get("name"));
        tokenStore.put(token, new AuthSession(userId, name, false, wxUser));
        return token;
    }

    @Override
    public Optional<AuthSession> resolve(String rawAuthorization) {
        String token = normalizeToken(rawAuthorization);
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(tokenStore.get(token));
    }

    @Override
    public void remove(String rawAuthorization) {
        String token = normalizeToken(rawAuthorization);
        if (token != null && !token.isBlank()) {
            tokenStore.remove(token);
        }
    }

    private String normalizeToken(String rawAuthorization) {
        if (rawAuthorization == null) {
            return null;
        }
        String value = rawAuthorization.trim();
        if (value.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return value.substring(7).trim();
        }
        return value;
    }
}

