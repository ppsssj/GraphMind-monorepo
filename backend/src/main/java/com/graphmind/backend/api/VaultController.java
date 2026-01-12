package com.graphmind.backend.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;
import com.graphmind.backend.service.VaultService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * ✅ 405 Method Not Allowed / 404 Not Found 해결 포인트
 * - 프론트가 PATCH /api/v1/vault/items/{id} 또는 /content 로 저장을 시도함
 * - 기존 백엔드에 해당 매핑이 없어서:
 *   - /content: 404 (경로 없음)
 *   - /items/{id}: 405 (경로는 있으나 PATCH 메서드 미지원)
 *
 * 따라서 아래 2개를 추가:
 * - PATCH /items/{id}
 * - PATCH /items/{id}/content
 */
@RestController
@RequestMapping("/api/v1/vault")
public class VaultController {

    private final VaultService vault;

    public VaultController(VaultService vault) {
        this.vault = vault;
    }

    private String userId(HttpServletRequest req) {
        Object v = req.getAttribute("userId");
        if (v == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        return String.valueOf(v);
    }

    // =========================
    // List
    // =========================
    @GetMapping("/items")
    public Object listItems(
            HttpServletRequest req,
            @RequestParam(defaultValue = "summary") String view,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String q
    ) {
        String uid = userId(req);
        if ("full".equalsIgnoreCase(view)) {
            return vault.listFull(uid, tag, q);
        }
        return vault.listSummary(uid, tag, q);
    }

    // =========================
    // Create / Update (full)
    // =========================
    @PostMapping("/items")
    public VaultItem create(HttpServletRequest req, @RequestBody VaultService.VaultUpsert body) {
        return vault.create(userId(req), body);
    }

    @PutMapping("/items/{id}")
    public VaultItem update(HttpServletRequest req, @PathVariable String id, @RequestBody VaultService.VaultUpsert body) {
        return vault.update(userId(req), id, body);
    }

    // =========================
    // Patch: meta only (existing pattern)
    // =========================
    @PatchMapping("/items/{id}/meta")
    public VaultItem patchMeta(HttpServletRequest req, @PathVariable String id, @RequestBody VaultService.VaultMetaPatch patch) {
        return vault.patchMeta(userId(req), id, patch);
    }

    // =========================
    // ✅ Patch: content only (NEW)
    // 프론트에서 { content: ... } 또는 content 자체(Json)로 보낼 수 있으므로 둘 다 지원.
    // =========================
    @PatchMapping("/items/{id}/content")
    public VaultItem patchContent(HttpServletRequest req, @PathVariable String id, @RequestBody JsonNode body) {
        JsonNode content = body;
        if (body != null && body.has("content")) {
            content = body.get("content");
        }
        return vault.patchContent(userId(req), id, content);
    }

    // =========================
    // ✅ Patch: generic item patch (NEW)
    // curve3d/surface3d/array3d 포함해서 필요한 필드만 PATCH 가능
    // =========================
    @PatchMapping("/items/{id}")
    public VaultItem patchItem(HttpServletRequest req, @PathVariable String id, @RequestBody VaultService.VaultItemPatch patch) {
        return vault.patchItem(userId(req), id, patch);
    }

    // =========================
    // Get / Delete
    // =========================
    @GetMapping("/items/{id}")
    public VaultItem getOne(HttpServletRequest req, @PathVariable String id) {
        return vault.getOwned(userId(req), id);
    }

    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(HttpServletRequest req, @PathVariable String id) {
        vault.delete(userId(req), id);
    }
}
