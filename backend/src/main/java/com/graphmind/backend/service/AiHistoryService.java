package com.graphmind.backend.service;

import com.graphmind.backend.domain.ai.AiHistoryItem;
import com.graphmind.backend.service.storage.AiHistoryStore;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiHistoryService {
    private final AiHistoryStore store;

    public AiHistoryService(AiHistoryStore store) {
        this.store = store;
    }

    public List<AiHistoryItem> list(String scope, String tabId, String filter, String q, Integer limit) {
        int lim = (limit == null) ? 200 : Math.max(1, Math.min(500, limit));
        List<AiHistoryItem> base = store.listAll();

        if ("tab".equalsIgnoreCase(scope)) {
            base = base.stream()
                    .filter(x -> Objects.equals(x.getTabId(), tabId))
                    .collect(Collectors.toList());
        }

        if (filter != null && !"all".equalsIgnoreCase(filter)) {
            String f = filter.trim().toLowerCase();
            base = base.stream()
                    .filter(x -> (x.getTab() == null ? "chat" : x.getTab().toLowerCase()).equals(f))
                    .collect(Collectors.toList());
        }

        if (q != null && !q.trim().isEmpty()) {
            String qq = q.trim().toLowerCase();
            base = base.stream().filter(x -> {
                String blob = (nz(x.getCtxTitle()) + "\n" + nz(x.getCtxType()) + "\n" + nz(x.getTab()) + "\n"
                        + nz(x.getInput()) + "\n" + nz(x.getOutput()) + "\n" + nz(x.getRaw())).toLowerCase();
                return blob.contains(qq);
            }).collect(Collectors.toList());
        }

        return base.stream().limit(lim).collect(Collectors.toList());
    }

    private String nz(String s) { return s == null ? "" : s; }

    public AiHistoryItem create(AiHistoryItem item) {
        return store.add(item, 2000);
    }

    public void clear(String scope, String tabId) {
        if ("tab".equalsIgnoreCase(scope)) store.clearByTabId(tabId);
        else store.clearAll();
    }
}
