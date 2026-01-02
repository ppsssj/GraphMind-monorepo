package com.graphmind.backend.domain;

public record LinkRef(
        String refType, // "VAULT_ITEM" | "STUDIO_PROJECT"
        String refId,
        String label
) {}
