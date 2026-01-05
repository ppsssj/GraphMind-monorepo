package com.graphmind.backend.api;

import com.graphmind.backend.api.dto.AiHistoryCreateRequest;
import com.graphmind.backend.domain.ai.AiHistoryItem;
import com.graphmind.backend.service.AiHistoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/ai/history") // ✅ v1로 통일
public class AiHistoryController {

    private final AiHistoryService service;

    public AiHistoryController(AiHistoryService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestAttribute("userId") String userId,   // ✅ AuthFilter가 넣어줌
            @RequestParam(defaultValue = "all") String scope,
            @RequestParam(required = false) String tabId,
            @RequestParam(defaultValue = "all") String filter,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit
    ) {
        if ("tab".equalsIgnoreCase(scope) && (tabId == null || tabId.isBlank())) {
            return Map.of("items", List.of());
        }
        List<AiHistoryItem> items = service.list(userId, scope, tabId, filter, q, limit);
        return Map.of("items", items);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @RequestAttribute("userId") String userId,
            @Valid @RequestBody AiHistoryCreateRequest req
    ) {
        AiHistoryItem item = new AiHistoryItem();
        item.setId(UUID.randomUUID().toString());
        item.setUserId(userId);

        // ✅ ts 파싱 실패 방어
        try {
            item.setTs((req.ts != null && !req.ts.isBlank()) ? Instant.parse(req.ts) : Instant.now());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_ts");
        }

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
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "all") String scope,
            @RequestParam(required = false) String tabId
    ) {
        if ("tab".equalsIgnoreCase(scope) && (tabId == null || tabId.isBlank())) {
            return Map.of("ok", true);
        }
        service.clear(userId, scope, tabId);
        return Map.of("ok", true);
    }
}
