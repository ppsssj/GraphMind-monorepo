package com.graphmind.backend.domain.ai;

import tools.jackson.databind.JsonNode;
import java.time.Instant;

public class AiHistoryItem {
    private String id;
    private Instant ts;
    private String tabId;
    private String ctxType;
    private String ctxTitle;
    private String tab;
    private String input;
    private String output;
    private String raw;
    private JsonNode parsed;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Instant getTs() { return ts; }
    public void setTs(Instant ts) { this.ts = ts; }

    public String getTabId() { return tabId; }
    public void setTabId(String tabId) { this.tabId = tabId; }

    public String getCtxType() { return ctxType; }
    public void setCtxType(String ctxType) { this.ctxType = ctxType; }

    public String getCtxTitle() { return ctxTitle; }
    public void setCtxTitle(String ctxTitle) { this.ctxTitle = ctxTitle; }

    public String getTab() { return tab; }
    public void setTab(String tab) { this.tab = tab; }

    public String getInput() { return input; }
    public void setInput(String input) { this.input = input; }

    public String getOutput() { return output; }
    public void setOutput(String output) { this.output = output; }

    public String getRaw() { return raw; }
    public void setRaw(String raw) { this.raw = raw; }

    public JsonNode getParsed() { return parsed; }
    public void setParsed(JsonNode parsed) { this.parsed = parsed; }
}
