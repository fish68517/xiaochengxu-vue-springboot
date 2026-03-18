package com.charging.backend.support;

import java.util.Map;

public class AuthSession {
    private final Long userId;
    private final String userName;
    private final boolean admin;
    private final Map<String, Object> wxUser;

    public AuthSession(Long userId, String userName, boolean admin, Map<String, Object> wxUser) {
        this.userId = userId;
        this.userName = userName;
        this.admin = admin;
        this.wxUser = wxUser;
    }

    public Long getUserId() {
        return userId;
    }

    public String getUserName() {
        return userName;
    }

    public boolean isAdmin() {
        return admin;
    }

    public Map<String, Object> getWxUser() {
        return wxUser;
    }
}

