package com.graphmind.backend.service;

import tools.jackson.databind.JsonNode;

import com.graphmind.backend.domain.LinkRef;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;

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

        JsonNode content = body.content();
        String type = body.type();

        String expr = body.expr();
        Integer samples = body.samples();

        // ✅ create에서도 content가 있으면 요약값 동기화
        if (content != null && type != null) {
            expr = deriveExpr(type, content, expr);
            samples = deriveSamples(type, content, samples);
        }

        VaultItem item = new VaultItem(
                id,
                userId,
                orDefault(body.title(), defaultTitle(body.type())),
                body.type(),
                body.formula(),
                expr,
                samples,
                body.axisOrder(),
                body.sizeX(),
                body.sizeY(),
                body.sizeZ(),
                normTags(body.tags()),
                content,
                body.links() == null ? List.of() : body.links(),
                now
        );

        item = maybeInferArrayDims(item);
        store.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(id, item);
        return item;
    }

    @Override
    public VaultItem update(String userId, String id, VaultUpsert body) {
        VaultItem prev = getOwned(userId, id);
        Instant now = Instant.now();

        JsonNode nextContent = body.content() != null ? body.content() : prev.content();
        String nextType = orDefault(body.type(), prev.type());

        String nextExpr = body.expr() != null ? body.expr() : prev.expr();
        Integer nextSamples = body.samples() != null ? body.samples() : prev.samples();

        // ✅ update에서도 content가 있으면 요약값 동기화
        if (nextContent != null && nextType != null) {
            nextExpr = deriveExpr(nextType, nextContent, nextExpr);
            nextSamples = deriveSamples(nextType, nextContent, nextSamples);
        }

        VaultItem next = new VaultItem(
                prev.id(),
                prev.userId(),
                orDefault(body.title(), prev.title()),
                nextType,
                orDefault(body.formula(), prev.formula()),
                nextExpr,
                nextSamples,
                orDefault(body.axisOrder(), prev.axisOrder()),
                body.sizeX() != null ? body.sizeX() : prev.sizeX(),
                body.sizeY() != null ? body.sizeY() : prev.sizeY(),
                body.sizeZ() != null ? body.sizeZ() : prev.sizeZ(),
                body.tags() != null ? normTags(body.tags()) : prev.tags(),
                nextContent,
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

        // equation 타입만 formula 변경 허용
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

    // =========================
    // ✅ /content PATCH: content + 요약값 동기화
    // =========================
    @Override
    public VaultItem patchContent(String userId, String id, JsonNode content) {
        VaultItem prev = getOwned(userId, id);
        Instant now = Instant.now();

        JsonNode nextContent = (content != null) ? content : prev.content();

        String nextExpr = prev.expr();
        Integer nextSamples = prev.samples();

        if (nextContent != null && prev.type() != null) {
            nextExpr = deriveExpr(prev.type(), nextContent, nextExpr);
            nextSamples = deriveSamples(prev.type(), nextContent, nextSamples);
        }

        VaultItem next = new VaultItem(
                prev.id(),
                prev.userId(),
                prev.title(),
                prev.type(),
                prev.formula(),
                nextExpr,
                nextSamples,
                prev.axisOrder(),
                prev.sizeX(),
                prev.sizeY(),
                prev.sizeZ(),
                prev.tags() != null ? prev.tags() : List.of(),
                nextContent,
                prev.links() != null ? prev.links() : List.of(),
                now
        );

        next = maybeInferArrayDims(next);
        store.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(id, next);
        return next;
    }

    // =========================
    // ✅ /items PATCH: content 들어오면 요약값 동기화
    // =========================
    @Override
    public VaultItem patchItem(String userId, String id, VaultItemPatch patch) {
        VaultItem prev = getOwned(userId, id);
        Instant now = Instant.now();

        String nextType = prev.type();
        if (patch.type() != null && !patch.type().isBlank()) nextType = patch.type().trim();

        String nextTitle = prev.title();
        if (patch.title() != null) {
            String t = patch.title().trim();
            nextTitle = t.isBlank() ? prev.title() : t;
        }

        List<String> nextTags = patch.tags() != null ? normTags(patch.tags()) : prev.tags();

        String nextAxisOrder = patch.axisOrder() != null ? orDefault(patch.axisOrder(), prev.axisOrder()) : prev.axisOrder();

        Integer nextSizeX = patch.sizeX() != null ? patch.sizeX() : prev.sizeX();
        Integer nextSizeY = patch.sizeY() != null ? patch.sizeY() : prev.sizeY();
        Integer nextSizeZ = patch.sizeZ() != null ? patch.sizeZ() : prev.sizeZ();

        JsonNode nextContent = patch.content() != null ? patch.content() : prev.content();

        String nextFormula = prev.formula();
        if (patch.formula() != null && "equation".equals(nextType)) {
            String f = patch.formula().trim();
            nextFormula = f.isBlank() ? prev.formula() : f;
        }

        String nextExpr = patch.expr() != null ? patch.expr() : prev.expr();
        Integer nextSamples = patch.samples() != null ? patch.samples() : prev.samples();

        if (nextContent != null && nextType != null) {
            nextExpr = deriveExpr(nextType, nextContent, nextExpr);
            nextSamples = deriveSamples(nextType, nextContent, nextSamples);
        }

        List<LinkRef> nextLinks = patch.links() != null ? patch.links() : prev.links();

        VaultItem next = new VaultItem(
                prev.id(),
                prev.userId(),
                nextTitle,
                nextType,
                nextFormula,
                nextExpr,
                nextSamples,
                nextAxisOrder,
                nextSizeX,
                nextSizeY,
                nextSizeZ,
                nextTags,
                nextContent,
                nextLinks,
                now
        );

        next = maybeInferArrayDims(next);
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

    // ------------------- ✅ derive helpers -------------------

    private String deriveExpr(String type, JsonNode content, String fallback) {
        if (type == null || content == null || !content.isObject()) return fallback;

        if ("surface3d".equals(type)) {
            JsonNode n = content.get("expr");
            if (n != null && n.isTextual()) {
                String v = n.asText().trim();
                if (!v.isBlank()) return v;
            }
            return fallback;
        }

        if ("curve3d".equals(type)) {
            String x = text(content, "xExpr", text(content, "x", null));
            String y = text(content, "yExpr", text(content, "y", null));
            String z = text(content, "zExpr", text(content, "z", null));

            if (x != null || y != null || z != null) {
                String xx = (x == null || x.isBlank()) ? "0" : x;
                String yy = (y == null || y.isBlank()) ? "0" : y;
                String zz = (z == null || z.isBlank()) ? "0" : z;
                return "x(t)=" + xx + ", y(t)=" + yy + ", z(t)=" + zz;
            }
            return fallback;
        }

        return fallback;
    }

    private Integer deriveSamples(String type, JsonNode content, Integer fallback) {
        if (type == null || content == null || !content.isObject()) return fallback;

        if ("surface3d".equals(type)) {
            Integer nx = integer(content, "nx", null);
            if (nx != null) return nx;
            Integer s = integer(content, "samples", null);
            return s != null ? s : fallback;
        }

        if ("curve3d".equals(type)) {
            Integer s = integer(content, "samples", null);
            return s != null ? s : fallback;
        }

        return fallback;
    }

    private String text(JsonNode obj, String key, String fallback) {
        JsonNode n = obj.get(key);
        if (n == null) return fallback;
        if (n.isTextual()) {
            String v = n.asText();
            return v != null ? v.trim() : fallback;
        }
        return fallback;
    }

    private Integer integer(JsonNode obj, String key, Integer fallback) {
        JsonNode n = obj.get(key);
        if (n == null) return fallback;
        if (n.isInt() || n.isLong()) return n.asInt();
        if (n.isTextual()) {
            try { return Integer.parseInt(n.asText().trim()); } catch (Exception ignored) {}
        }
        return fallback;
    }
}
