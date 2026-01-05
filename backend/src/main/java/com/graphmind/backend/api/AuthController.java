package com.graphmind.backend.api;

import com.graphmind.backend.domain.User;
import com.graphmind.backend.repo.InMemoryStore;
import com.graphmind.backend.repo.TokenStore;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final InMemoryStore store;
    private final TokenStore tokenStore;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthController(InMemoryStore store, TokenStore tokenStore) {
        this.store = store;
        this.tokenStore = tokenStore;
    }

    public record RegisterReq(String email, String password, String displayName) {}
    public record LoginReq(String email, String password) {}

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegisterReq req) {
        if (req == null) throw bad("body_required");

        String email = normEmail(req.email());
        String password = req.password();

        if (email.isBlank()) throw bad("email_required");
        if (password == null || password.length() < 8) throw bad("weak_password");

        if (store.accountsByEmail.containsKey(email)) throw conflict("email_exists");

        String userId = UUID.randomUUID().toString();
        String displayName = (req.displayName() == null || req.displayName().isBlank())
                ? "USER"
                : req.displayName().trim();

        User user = new User(userId, displayName, Instant.now());
        store.users.put(userId, user);

        store.accountsByEmail.put(email,
                new InMemoryStore.LocalAccount(userId, email, encoder.encode(password)));

        // 가입과 동시에 토큰 발급 (프론트 구현 단순화)
        String token = UUID.randomUUID().toString();
        tokenStore.bind(token, userId);

        return Map.of("user", user, "token", token);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginReq req) {
        if (req == null) throw bad("body_required");

        String email = normEmail(req.email());
        String password = req.password();

        if (email.isBlank() || password == null) throw unauthorized("invalid_credentials");

        InMemoryStore.LocalAccount acc = store.accountsByEmail.get(email);
        if (acc == null) throw unauthorized("invalid_credentials");

        if (!encoder.matches(password, acc.passwordHash())) {
            throw unauthorized("invalid_credentials");
        }

        String token = UUID.randomUUID().toString();
        tokenStore.bind(token, acc.userId());

        User user = store.users.get(acc.userId());
        if (user == null) {
            // 데이터 불일치(계정은 있는데 user가 없는 상태)
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "user_missing");
        }

        return Map.of("user", user, "token", token);
    }


    private String normEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private ResponseStatusException bad(String code) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, code);
    }

    private ResponseStatusException conflict(String code) {
        return new ResponseStatusException(HttpStatus.CONFLICT, code);
    }

    private ResponseStatusException unauthorized(String code) {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, code);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(@RequestHeader(value="Authorization", required=false) String auth) {
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring("Bearer ".length()).trim();
            if (!token.isEmpty()) tokenStore.revoke(token);
        }
        return Map.of("ok", true);
    }

}
