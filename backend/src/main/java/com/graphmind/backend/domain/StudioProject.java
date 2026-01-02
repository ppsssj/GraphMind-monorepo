package com.graphmind.backend.domain;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

public record StudioProject(
        String id,
        String userId,
        String title,
        String kind,     // "graph" | "curve" | "surface"
        JsonNode payload,
        Instant updatedAt
) {}
