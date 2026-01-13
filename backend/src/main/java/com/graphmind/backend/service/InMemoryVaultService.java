package com.graphmind.backend.service;

//import tools.jackson.databind.JsonNode;
import tools.jackson.databind.JsonNode;
import com.graphmind.backend.domain.LinkRef;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.Collections;
import com.graphmind.backend.domain.LinkRef; // LinkRef 寃쎈줈???꾨줈?앺듃??留욊쾶

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

        // array3d硫?dims ?먮룞 異붾줎(?덉쑝硫??곗꽑 ?ъ슜)
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

        // equation???뚮쭔 formula ?섏젙 ?덉슜 (洹?????낆? 臾댁떆)
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
    // ??NEW: content留?遺遺??낅뜲?댄듃
    // =========================
    @Override
    public VaultItem patchContent(String userId, String id, JsonNode content) {
        VaultItem prev = getOwned(userId, id); // ?놁쑝硫?NoSuchElementException ??ApiExceptionHandler媛 404濡?蹂??

        Instant now = Instant.now();

        JsonNode nextContent = (content != null) ? content : prev.content();
        List<String> nextTags = (prev.tags() != null) ? prev.tags() : List.of();
        List<LinkRef> nextLinks = (prev.links() != null) ? prev.links() : Collections.emptyList();


        VaultItem next = new VaultItem(
                prev.id(),
                prev.userId(),
                prev.title(),
                prev.type(),
                prev.formula(),
                prev.expr(),
                prev.samples(),
                prev.axisOrder(),
                prev.sizeX(),
                prev.sizeY(),
                prev.sizeZ(),
                nextTags,
                nextContent,
                nextLinks,
                now
        );

        next = maybeInferArrayDims(next);
        store.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(id, next);
        return next;
    }


    // =========================
    // ??NEW: item ?꾩껜(遺遺? ?낅뜲?댄듃
    // =========================
    @Override
    public VaultItem patchItem(String userId, String id, VaultItemPatch patch) {
        VaultItem prev = getOwned(userId, id);
        Instant now = Instant.now();

        // type??諛붾뚮㈃ 洹?type 湲곗??쇰줈 ?쒖빟(?? formula ?덉슜 ?щ?)??寃곗젙
        String nextType = prev.type();
        if (patch.type() != null && !patch.type().isBlank()) {
            nextType = patch.type().trim();
        }

        String nextTitle = prev.title();
        if (patch.title() != null) {
            String t = patch.title().trim();
            nextTitle = t.isBlank() ? prev.title() : t;
        }

        List<String> nextTags = patch.tags() != null ? normTags(patch.tags()) : prev.tags();

        String nextAxisOrder = prev.axisOrder();
        if (patch.axisOrder() != null) {
            nextAxisOrder = orDefault(patch.axisOrder(), prev.axisOrder());
        }

        Integer nextSizeX = patch.sizeX() != null ? patch.sizeX() : prev.sizeX();
        Integer nextSizeY = patch.sizeY() != null ? patch.sizeY() : prev.sizeY();
        Integer nextSizeZ = patch.sizeZ() != null ? patch.sizeZ() : prev.sizeZ();

        String nextExpr = patch.expr() != null ? patch.expr() : prev.expr();
        Integer nextSamples = patch.samples() != null ? patch.samples() : prev.samples();

        // formula??equation ??낆씪 ?뚮쭔 ?섎? ?덇쾶 諛섏쁺 (湲곗〈 ?뺤콉 ?좎?)
        String nextFormula = prev.formula();
        if (patch.formula() != null && "equation".equals(nextType)) {
            String f = patch.formula().trim();
            nextFormula = f.isBlank() ? prev.formula() : f;
        }

        JsonNode nextContent = patch.content() != null ? patch.content() : prev.content();
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

        // 湲곕낯 媛?? content[z][y][x]
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

