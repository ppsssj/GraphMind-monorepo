package com.graphmind.backend.service;


import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import com.graphmind.backend.domain.StudioProject;
import com.graphmind.backend.repo.InMemoryStore;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StudioService {
    private final InMemoryStore store;
    private final HistoryService history;
    private final ObjectMapper om = new ObjectMapper();

    public StudioService(InMemoryStore store, HistoryService history) {
        this.store = store;
        this.history = history;
    }

    public StudioProject create(String userId, String title, String kind, JsonNode payload) {
        String id = UUID.randomUUID().toString();
        StudioProject p = new StudioProject(
                id, userId,
                title == null ? "Untitled" : title,
                kind == null ? "graph" : kind,
                payload,
                Instant.now()
        );
        store.studioProjects.put(id, p);
        history.append(userId, "STUDIO", id, "CREATE", toPayload(p));
        return p;
    }

    public StudioProject update(String userId, String id, String title, String kind, JsonNode payload) {
        StudioProject prev = getOwned(userId, id);
        StudioProject next = new StudioProject(
                prev.id(), prev.userId(),
                title != null ? title : prev.title(),
                kind != null ? kind : prev.kind(),
                payload != null ? payload : prev.payload(),
                Instant.now()
        );
        store.studioProjects.put(id, next);
        history.append(userId, "STUDIO", id, "UPDATE", toPayload(next));
        return next;
    }

    public StudioProject getOwned(String userId, String id) {
        StudioProject p = store.studioProjects.get(id);
        if (p == null || !p.userId().equals(userId)) throw new NoSuchElementException("studio_project_not_found");
        return p;
    }

    public List<StudioProject> list(String userId, String kind, String q) {
        String qn = q == null ? null : q.toLowerCase(Locale.ROOT);
        return store.studioProjects.values().stream()
                .filter(p -> p.userId().equals(userId))
                .filter(p -> kind == null || kind.isBlank() || p.kind().equalsIgnoreCase(kind))
                .filter(p -> qn == null || qn.isBlank() || p.title().toLowerCase(Locale.ROOT).contains(qn))
                .sorted(Comparator.comparing(StudioProject::updatedAt).reversed())
                .collect(Collectors.toList());
    }

    public void snapshot(String userId, String id, JsonNode payload) {
        StudioProject p = getOwned(userId, id);
        history.append(userId, "STUDIO", p.id(), "SNAPSHOT", payload);
    }

    private JsonNode  toPayload(StudioProject p) {
        ObjectNode n = om.createObjectNode();
        n.put("id", p.id());
        n.put("title", p.title());
        n.put("kind", p.kind());
        n.put("updatedAt", p.updatedAt().toString());
        return n;
    }
}

