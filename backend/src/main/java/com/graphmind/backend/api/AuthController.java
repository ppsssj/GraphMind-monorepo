package com.graphmind.backend.api;

import com.graphmind.backend.domain.User;
import com.graphmind.backend.repo.InMemoryStore;
import com.graphmind.backend.repo.TokenStore;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final InMemoryStore store;
    private final TokenStore tokenStore;

    public AuthController(InMemoryStore store, TokenStore tokenStore) {
        this.store = store;
        this.tokenStore = tokenStore;
    }

    public record GuestLoginReq(String displayName) {}

    @PostMapping("/guest")
    public Map<String, Object> guest(@RequestBody GuestLoginReq req) {
        String userId = UUID.randomUUID().toString();
        String token = UUID.randomUUID().toString();

        String name = (req == null || req.displayName() == null || req.displayName().isBlank())
                ? "Guest" : req.displayName().trim();

        User user = new User(userId, name, Instant.now());
        store.users.put(userId, user);
        tokenStore.bind(token, userId);

        return Map.of(
                "user", user,
                "token", token
        );
    }
}
