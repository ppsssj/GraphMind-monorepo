package com.graphmind.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import tools.jackson.databind.JsonNode;

public class AiHistoryCreateRequest {
    public String ts;
    public String tabId;
    public String ctxType;
    public String ctxTitle;

    @NotBlank
    public String tab;

    public String input;
    public String output;
    public String raw;
    public JsonNode parsed;
}
