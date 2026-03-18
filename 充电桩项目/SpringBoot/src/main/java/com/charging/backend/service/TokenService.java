package com.charging.backend.service;

import com.charging.backend.support.AuthSession;

import java.util.Map;
import java.util.Optional;

public interface TokenService {

    String createAdminToken(String userName);

    String createWxToken(Map<String, Object> wxUser);

    Optional<AuthSession> resolve(String rawAuthorization);

    void remove(String rawAuthorization);
}

