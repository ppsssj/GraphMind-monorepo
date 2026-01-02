package com.graphmind.backend.api;

import com.graphmind.backend.domain.User;
import com.graphmind.backend.repo.InMemoryStore;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class MeController {

    private final InMemoryStore store;

    public MeController(InMemoryStore store) {
        this.store = store;
    }

    @GetMapping("/me")
    public User me(HttpServletRequest req) {
        String userId = (String) req.getAttribute("userId");
        return store.users.get(userId);
    }
}
