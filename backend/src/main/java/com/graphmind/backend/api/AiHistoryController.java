package com.graphmind.backend.api;

import com.graphmind.backend.api.dto.AiHistoryCreateRequest;
import com.graphmind.backend.domain.ai.AiHistoryItem;
import com.graphmind.backend.service.AiHistoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/ai/history")
public class AiHistoryController {

    private final AiHistoryService service;

    public AiHistoryController(AiHistoryService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam(defaultValue = "all") String scope,
            @RequestParam(required = false) String tabId,
            @RequestParam(defaultValue = "all") String filter,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit
    ) {
        if ("tab".equalsIgnoreCase(scope) && (tabId == null || tabId.isBlank())) {
            return Map.of("items", List.of());
        }
        List<AiHistoryItem> items = service.list(scope, tabId, filter, q, limit);
        return Map.of("items", items);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody AiHistoryCreateRequest req) {
        AiHistoryItem item = new AiHistoryItem();
        item.setId(UUID.randomUUID().toString());
        item.setTs((req.ts != null && !req.ts.isBlank()) ? Instant.parse(req.ts) : Instant.now());
        item.setTabId(req.tabId);
        item.setCtxType(req.ctxType);
        item.setCtxTitle(req.ctxTitle);
        item.setTab(req.tab == null ? "chat" : req.tab.toLowerCase());
        item.setInput(req.input == null ? "" : req.input);
        item.setOutput(req.output == null ? "" : req.output);
        item.setRaw(req.raw);
        item.setParsed(req.parsed);

        AiHistoryItem created = service.create(item);
        return ResponseEntity.status(201).body(Map.of("item", created));
    }

    @DeleteMapping
    public Map<String, Object> clear(
            @RequestParam(defaultValue = "all") String scope,
            @RequestParam(required = false) String tabId
    ) {
        if ("tab".equalsIgnoreCase(scope) && (tabId == null || tabId.isBlank())) {
            return Map.of("ok", true);
        }
        service.clear(scope, tabId);
        return Map.of("ok", true);
    }
}
