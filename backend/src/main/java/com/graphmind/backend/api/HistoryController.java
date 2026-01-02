package com.graphmind.backend.api;

import com.graphmind.backend.domain.HistoryEvent;
import com.graphmind.backend.service.HistoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/history")
public class HistoryController {

    private final HistoryService history;

    public HistoryController(HistoryService history) {
        this.history = history;
    }

    @GetMapping
    public List<HistoryEvent> list(HttpServletRequest req,
                                   @RequestParam(required = false) String scope,
                                   @RequestParam(required = false) String entityId,
                                   @RequestParam(required = false) String type,
                                   @RequestParam(defaultValue = "50") int limit) {
        String userId = (String) req.getAttribute("userId");
        return history.query(userId, scope, entityId, type, limit);
    }
}
