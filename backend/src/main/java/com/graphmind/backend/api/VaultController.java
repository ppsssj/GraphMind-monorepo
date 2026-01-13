package com.graphmind.backend.api;

//import tools.jackson.databind.JsonNode;
import tools.jackson.databind.JsonNode;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;
import com.graphmind.backend.service.VaultService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.NoSuchElementException;

import java.util.List;

/**
 * ??405 Method Not Allowed / 404 Not Found ?닿껐 ?ъ씤??
 * - ?꾨줎?멸? PATCH /api/v1/vault/items/{id} ?먮뒗 /content 濡???μ쓣 ?쒕룄??
 * - 湲곗〈 諛깆뿏?쒖뿉 ?대떦 留ㅽ븨???놁뼱??
 *   - /content: 404 (寃쎈줈 ?놁쓬)
 *   - /items/{id}: 405 (寃쎈줈???덉쑝??PATCH 硫붿꽌??誘몄???
 *
 * ?곕씪???꾨옒 2媛쒕? 異붽?:
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
    // ??Patch: content only (NEW)
    // ?꾨줎?몄뿉??{ content: ... } ?먮뒗 content ?먯껜(Json)濡?蹂대궪 ???덉쑝誘濡?????吏??
    // =========================
    @PatchMapping("/items/{id}/content")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void patchContent(
            HttpServletRequest req,
            @PathVariable String id,
            @RequestBody JsonNode body
    ) {
        JsonNode content = body;
        if (body != null && body.has("content")) {
            content = body.get("content");
        }

        String uid = userId(req);

        // ???먯씤 ?뺤젙??濡쒓렇 媛뺥솕
        System.out.printf(
                "[vault] PATCH /content uid=%s id=%s bodyType=%s contentType=%s contentLength=%s%n",
                uid,
                id,
                (body == null ? "null" : body.getNodeType()),
                (content == null ? "null" : content.getNodeType()),
                req.getHeader("Content-Length")
        );

        try {
            vault.patchContent(uid, id, content);
        } catch (NoSuchElementException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        } catch (Exception e) {
            e.printStackTrace(); // ???ш린???쒕쾭 肄섏넄???ㅽ깮??諛섎뱶???좎빞 ??
            throw e;
        }
    }





    // =========================
    // ??Patch: generic item patch (NEW)
    // curve3d/surface3d/array3d ?ы븿?댁꽌 ?꾩슂???꾨뱶留?PATCH 媛??
    // =========================
    @PatchMapping("/items/{id}")
    public VaultItem patchItem(HttpServletRequest req, @PathVariable String id, @RequestBody VaultService.VaultItemPatch patch) {
        String uid = userId(req);

        // ???먯씤 ?뺤젙??濡쒓렇
        try {
            System.out.printf(
                    "[vault] PATCH /items uid=%s id=%s type=%s title=%s formula=%s expr=%s hasContent=%s%n",
                    uid,
                    id,
                    patch.type(),
                    patch.title(),
                    patch.formula(),
                    patch.expr(),
                    (patch.content() != null)
            );
        } catch (Exception ignore) {}

        return vault.patchItem(uid, id, patch);
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

