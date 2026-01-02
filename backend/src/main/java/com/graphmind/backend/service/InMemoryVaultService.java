package com.graphmind.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;
import com.graphmind.backend.domain.LinkRef;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class InMemoryVaultService implements VaultService {

    // userId -> (itemId -> item)
    private final Map<String, Map<String, VaultItem>> store = new ConcurrentHashMap<>();

    @Override
    public List<VaultItemSummary> listSummary(String userId, String tag, String q) {
        return listFull(userId, tag, q).stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    @Override
    public List<VaultItem> listFull(String userId, String tag, String q) {
        Map<String, VaultItem> m = store.getOrDefault(userId, Map.of());
        return m.values().stream()
                .filter(it -> tag == null || tag.isBlank() || (it.tags() != null && it.tags().contains(tag)))
                .filter(it -> matchesQ(it, q))
                .sorted(Comparator.comparing(VaultItem::updatedAt).reversed())
                .toList();
    }

    @Override
    public VaultItem create(String userId, VaultUpsert body) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        VaultItem item = new VaultItem(
                id,
                userId,
                orDefault(body.title(), defaultTitle(body.type())),
                body.type(),
                body.formula(),
                body.expr(),
                body.samples(),
                body.axisOrder(),
                body.sizeX(),
                body.sizeY(),
                body.sizeZ(),
                normTags(body.tags()),
                body.content(),
                body.links() == null ? List.of() : body.links(),
                now
        );

        // array3d면 dims 자동 추론(있으면 우선 사용)
        item = maybeInferArrayDims(item);

        store.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(id, item);
        return item;
    }

    @Override
    public VaultItem update(String userId, String id, VaultUpsert body) {
        VaultItem prev = getOwned(userId, id);
        Instant now = Instant.now();

        VaultItem next = new VaultItem(
                prev.id(),
                prev.userId(),
                orDefault(body.title(), prev.title()),
                orDefault(body.type(), prev.type()),
                orDefault(body.formula(), prev.formula()),
                orDefault(body.expr(), prev.expr()),
                body.samples() != null ? body.samples() : prev.samples(),
                orDefault(body.axisOrder(), prev.axisOrder()),
                body.sizeX() != null ? body.sizeX() : prev.sizeX(),
                body.sizeY() != null ? body.sizeY() : prev.sizeY(),
                body.sizeZ() != null ? body.sizeZ() : prev.sizeZ(),
                body.tags() != null ? normTags(body.tags()) : prev.tags(),
                body.content() != null ? body.content() : prev.content(),
                body.links() != null ? body.links() : prev.links(),
                now
        );

        next = maybeInferArrayDims(next);
        store.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(id, next);
        return next;
    }

    @Override
    public VaultItem patchMeta(String userId, String id, VaultMetaPatch patch) {
        VaultItem prev = getOwned(userId, id);
        Instant now = Instant.now();

        String nextTitle = patch.title() != null ? patch.title().trim() : prev.title();
        List<String> nextTags = patch.tags() != null ? normTags(patch.tags()) : prev.tags();

        // equation일 때만 formula 수정 허용 (그 외 타입은 무시)
        String nextFormula = prev.formula();
        if ("equation".equals(prev.type()) && patch.formula() != null) {
            String f = patch.formula().trim();
            nextFormula = f.isBlank() ? prev.formula() : f;
        }

        VaultItem next = new VaultItem(
                prev.id(),
                prev.userId(),
                nextTitle,
                prev.type(),
                nextFormula,
                prev.expr(),
                prev.samples(),
                prev.axisOrder(),
                prev.sizeX(),
                prev.sizeY(),
                prev.sizeZ(),
                nextTags,
                prev.content(),
                prev.links(),
                now
        );

        store.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(id, next);
        return next;
    }

    @Override
    public VaultItem getOwned(String userId, String id) {
        VaultItem it = store.getOrDefault(userId, Map.of()).get(id);
        if (it == null) throw new NoSuchElementException("VaultItem not found: " + id);
        return it;
    }

    @Override
    public void delete(String userId, String id) {
        Map<String, VaultItem> m = store.get(userId);
        if (m != null) m.remove(id);
    }

    // ------------------- helpers -------------------

    private VaultItemSummary toSummary(VaultItem it) {
        return new VaultItemSummary(
                it.id(),
                it.title(),
                it.type(),
                it.formula(),
                it.expr(),
                it.samples(),
                it.axisOrder(),
                it.sizeX(),
                it.sizeY(),
                it.sizeZ(),
                it.tags(),
                it.updatedAt()
        );
    }

    private boolean matchesQ(VaultItem it, String q) {
        if (q == null || q.isBlank()) return true;
        String needle = q.trim().toLowerCase();

        String title = (it.title() == null ? "" : it.title()).toLowerCase();
        String type = (it.type() == null ? "" : it.type()).toLowerCase();
        String formula = (it.formula() == null ? "" : it.formula()).toLowerCase();
        String expr = (it.expr() == null ? "" : it.expr()).toLowerCase();
        String tags = it.tags() == null ? "" : String.join(" ", it.tags()).toLowerCase();

        String dims = "";
        if ("array3d".equals(it.type()) && it.sizeX() != null && it.sizeY() != null && it.sizeZ() != null) {
            dims = (it.sizeX() + "x" + it.sizeY() + "x" + it.sizeZ()).toLowerCase();
        }

        return (title.contains(needle)
                || type.contains(needle)
                || formula.contains(needle)
                || expr.contains(needle)
                || tags.contains(needle)
                || dims.contains(needle));
    }

    private List<String> normTags(List<String> tags) {
        if (tags == null) return List.of();
        return tags.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
    }

    private String defaultTitle(String type) {
        if (type == null) return "Untitled";
        return switch (type) {
            case "array3d" -> "3D Array";
            case "curve3d" -> "3D Curve";
            case "surface3d" -> "3D Surface";
            default -> "Equation";
        };
    }

    private String orDefault(String v, String fallback) {
        if (v == null) return fallback;
        String t = v.trim();
        return t.isBlank() ? fallback : t;
    }

    private VaultItem maybeInferArrayDims(VaultItem item) {
        if (!"array3d".equals(item.type())) return item;
        if (item.sizeX() != null && item.sizeY() != null && item.sizeZ() != null) return item;

        JsonNode c = item.content();
        if (c == null || !c.isArray() || c.size() == 0) return item;

        // 기본 가정: content[z][y][x]
        int z = c.size();
        int y = c.get(0).isArray() ? c.get(0).size() : 0;
        int x = (y > 0 && c.get(0).get(0).isArray()) ? c.get(0).get(0).size() : 0;

        return new VaultItem(
                item.id(), item.userId(), item.title(), item.type(),
                item.formula(), item.expr(), item.samples(),
                item.axisOrder() == null ? "zyx" : item.axisOrder(),
                x == 0 ? item.sizeX() : x,
                y == 0 ? item.sizeY() : y,
                z == 0 ? item.sizeZ() : z,
                item.tags(), item.content(), item.links(), item.updatedAt()
        );
    }
}
