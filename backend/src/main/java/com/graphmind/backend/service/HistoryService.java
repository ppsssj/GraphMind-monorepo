package com.graphmind.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.graphmind.backend.domain.HistoryEvent;
import com.graphmind.backend.repo.InMemoryStore;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class HistoryService {
    private final InMemoryStore store;

    public HistoryService(InMemoryStore store) {
        this.store = store;
    }

    public HistoryEvent append(String userId, String scope, String entityId, String type, JsonNode payload) {
        HistoryEvent ev = new HistoryEvent(
                UUID.randomUUID().toString(),
                userId,
                scope,
                entityId,
                type,
                payload,
                Instant.now()
        );
        store.history.addFirst(ev); // 최신이 앞
        return ev;
    }

    public List<HistoryEvent> query(String userId, String scope, String entityId, String type, int limit) {
        return store.history.stream()
                .filter(h -> h.userId().equals(userId))
                .filter(h -> scope == null || scope.isBlank() || h.scope().equalsIgnoreCase(scope))
                .filter(h -> entityId == null || entityId.isBlank() || h.entityId().equals(entityId))
                .filter(h -> type == null || type.isBlank() || h.type().equalsIgnoreCase(type))
                .limit(Math.max(1, Math.min(limit, 200)))
                .collect(Collectors.toList());
    }
}
