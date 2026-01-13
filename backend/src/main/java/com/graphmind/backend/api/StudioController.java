package com.graphmind.backend.api;

import tools.jackson.databind.JsonNode;
import com.graphmind.backend.domain.StudioProject;
import com.graphmind.backend.service.StudioService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/studio/projects")
public class StudioController {

    private final StudioService studio;

    public StudioController(StudioService studio) {
        this.studio = studio;
    }

    public record StudioUpsertReq(String title, String kind, JsonNode payload) {}

    @GetMapping
    public List<StudioProject> list(HttpServletRequest req,
                                    @RequestParam(required = false) String kind,
                                    @RequestParam(required = false) String q) {
        String userId = (String) req.getAttribute("userId");
        return studio.list(userId, kind, q);
    }

    @PostMapping
    public StudioProject create(HttpServletRequest req, @RequestBody StudioUpsertReq body) {
        String userId = (String) req.getAttribute("userId");
        return studio.create(userId,
                body == null ? null : body.title(),
                body == null ? null : body.kind(),
                body == null ? null : body.payload()
        );
    }

    @GetMapping("/{id}")
    public StudioProject get(HttpServletRequest req, @PathVariable String id) {
        String userId = (String) req.getAttribute("userId");
        return studio.getOwned(userId, id);
    }

    @PutMapping("/{id}")
    public StudioProject update(HttpServletRequest req, @PathVariable String id, @RequestBody StudioUpsertReq body) {
        String userId = (String) req.getAttribute("userId");
        return studio.update(userId, id,
                body == null ? null : body.title(),
                body == null ? null : body.kind(),
                body == null ? null : body.payload()
        );
    }

    @PostMapping("/{id}/snapshot")
    public void snapshot(HttpServletRequest req, @PathVariable String id, @RequestBody JsonNode payload) {
        String userId = (String) req.getAttribute("userId");
        studio.snapshot(userId, id, payload);
    }
}

