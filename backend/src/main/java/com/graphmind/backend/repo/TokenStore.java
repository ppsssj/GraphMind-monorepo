package com.graphmind.backend.repo;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class TokenStore {
    private final ConcurrentHashMap<String, String> tokenToUser = new ConcurrentHashMap<>();

    public void bind(String token, String userId) {
        tokenToUser.put(token, userId);
    }

    public String resolveUserId(String token) {
        return tokenToUser.get(token);
    }

    public void revoke(String token) {
        tokenToUser.remove(token);
    }
}
