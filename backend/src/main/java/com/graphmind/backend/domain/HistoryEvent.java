package com.graphmind.backend.domain;

import tools.jackson.databind.JsonNode;
import java.time.Instant;

public record HistoryEvent(
        String id,
        String userId,
        String scope,    // "VAULT" | "STUDIO"
        String entityId,
        String type,     // "CREATE" | "UPDATE" | "SNAPSHOT"
        JsonNode payload,
        Instant createdAt
) {}

