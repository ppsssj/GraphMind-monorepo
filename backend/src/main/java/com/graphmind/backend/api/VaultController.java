package com.graphmind.backend.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.graphmind.backend.domain.LinkRef;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;
import com.graphmind.backend.service.VaultService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/vault/items")
public class VaultController {

    private final VaultService vault;

    public VaultController(VaultService vault) {
        this.vault = vault;
    }

    // 프론트 요구 타입(후순위지만 array3d도 포함)
    private static final Set<String> ALLOWED_TYPES =
            Set.of("equation", "array3d", "curve3d", "surface3d");

    public record VaultUpsertReq(
            String title,
            String type,

            // equation / surface3d preview
            String formula,
            String expr,

            // curve3d / surface3d
            Integer samples,

            // array3d
            String axisOrder,
            Integer sizeX,
            Integer sizeY,
            Integer sizeZ,

            List<String> tags,
            JsonNode content,
            List<LinkRef> links
    ) {}

    public record VaultMetaPatchReq(
            String title,
            List<String> tags,
            String formula
    ) {}

    @GetMapping
    public Object list(HttpServletRequest req,
                       @RequestParam(required = false) String tag,
                       @RequestParam(required = false) String q,
                       @RequestParam(defaultValue = "summary") String view) {

        String userId = (String) req.getAttribute("userId");
        if ("full".equalsIgnoreCase(view)) {
            return vault.listFull(userId, tag, q);
        }
        return vault.listSummary(userId, tag, q);
    }

    @PostMapping
    public VaultItem create(HttpServletRequest req, @RequestBody VaultUpsertReq body) {
        String userId = (String) req.getAttribute("userId");
        VaultService.VaultUpsert upsert = toUpsert(body, true);
        return vault.create(userId, upsert);
    }

    @GetMapping("/{id}")
    public VaultItem get(HttpServletRequest req, @PathVariable String id) {
        String userId = (String) req.getAttribute("userId");
        return vault.getOwned(userId, id);
    }

    @PutMapping("/{id}")
    public VaultItem update(HttpServletRequest req, @PathVariable String id, @RequestBody VaultUpsertReq body) {
        String userId = (String) req.getAttribute("userId");
        VaultService.VaultUpsert upsert = toUpsert(body, false);
        return vault.update(userId, id, upsert);
    }

    /**
     * ✅ LeftPanel 편집(제목/태그 + equation일 때 formula만)
     */
    @PatchMapping("/{id}/meta")
    public VaultItem patchMeta(HttpServletRequest req, @PathVariable String id, @RequestBody VaultMetaPatchReq body) {
        String userId = (String) req.getAttribute("userId");
        if (body == null) throw bad("Body is required");
        return vault.patchMeta(userId, id, new VaultService.VaultMetaPatch(
                body.title(),
                body.tags(),
                body.formula()
        ));
    }

    @DeleteMapping("/{id}")
    public void delete(HttpServletRequest req, @PathVariable String id) {
        String userId = (String) req.getAttribute("userId");
        vault.delete(userId, id);
    }

    // ---------------- helpers ----------------

    private VaultService.VaultUpsert toUpsert(VaultUpsertReq body, boolean requireType) {
        if (body == null) throw bad("Body is required");

        String type = body.type();
        if (requireType && (type == null || type.isBlank())) {
            throw bad("type is required");
        }
        if (type != null && !type.isBlank() && !ALLOWED_TYPES.contains(type)) {
            throw bad("type must be one of " + ALLOWED_TYPES);
        }

        // 최소한의 타입별 체크(과도한 제약은 X)
        if ("equation".equals(type)) {
            // 프론트는 formula를 쓰는 구조
            if ((body.formula() == null || body.formula().isBlank())
                    && (body.expr() == null || body.expr().isBlank())) {
                // expr을 fallback으로 허용 (이전 데이터 호환)
                throw bad("equation requires formula (or expr as fallback)");
            }
        }
        if ("surface3d".equals(type)) {
            if (body.expr() == null || body.expr().isBlank()) {
                throw bad("surface3d requires expr");
            }
        }

        return new VaultService.VaultUpsert(
                body.title(),
                type,
                body.formula(),
                body.expr(),
                body.samples(),
                body.axisOrder(),
                body.sizeX(),
                body.sizeY(),
                body.sizeZ(),
                body.tags(),
                body.content(),
                body.links()
        );
    }

    private ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }
}
