package com.graphmind.backend.domain;

import java.time.Instant;

public record User(
        String id,
        String displayName,
        Instant createdAt
) {}
