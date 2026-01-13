package com.graphmind.backend.service;

import tools.jackson.databind.JsonNode;
import com.graphmind.backend.domain.LinkRef;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;

import java.util.List;

/**
 * Vault 鍮꾩쫰?덉뒪 濡쒖쭅 ?명꽣?섏씠??
 *
 * ??異붽?:
 * - patchContent: ??낅퀎 payload(content)留?遺遺??낅뜲?댄듃
 * - patchItem: curve3d/surface3d/array3d ????낅퀎 硫뷀?+payload瑜?遺遺??낅뜲?댄듃
 *
 * ?꾨줎?몄뿉??PATCH瑜?蹂대궡?붾뜲 405/404媛 ?⑤뒗 臾몄젣瑜??닿껐?섎젮硫?
 * Controller + Service + Implementation(InMemoryVaultService ??????硫붿꽌?쒕뱾??援ы쁽?섏뼱???⑸땲??
 */
public interface VaultService {

    /**
     * ?앹꽦/?꾩껜 媛깆떊(Upsert) 諛붾뵒.
     * - equation: formula ?ъ슜
     * - surface3d: expr ?ъ슜
     * - curve3d: samples ?ъ슜(?몃? x/y/z ?깆? content?????
     * - array3d: axisOrder + sizeX/Y/Z ?ъ슜(?ㅻ뜲?댄꽣??content?????
     */
    record VaultUpsert(
            String title,
            String type,
            String formula,
            String expr,
            Integer samples,
            String axisOrder,
            Integer sizeX,
            Integer sizeY,
            Integer sizeZ,
            List<String> tags,
            JsonNode content,
            List<LinkRef> links
    ) {}

    /**
     * ?쒖젣紐??쒓렇(+equation formula)?앸쭔 ?섏젙?섎뒗 ?몄쭛 湲곕뒫??
     * (湲곗〈 ?꾨줎??patchVaultMeta ?명솚)
     */
    record VaultMetaPatch(
            String title,
            List<String> tags,
            String formula
    ) {}

    /**
     * 遺遺??낅뜲?댄듃???좏깮 ?꾨뱶留?梨꾩썙??PATCH).
     * - curve3d / surface3d / array3d ?깆뿉?쒕룄 ?숈씪?섍쾶 ?ъ슜
     */
    record VaultItemPatch(
            String title,
            String type,
            String formula,
            String expr,
            Integer samples,
            String axisOrder,
            Integer sizeX,
            Integer sizeY,
            Integer sizeZ,
            List<String> tags,
            JsonNode content,
            List<LinkRef> links
    ) {}

    List<VaultItemSummary> listSummary(String userId, String tag, String q);
    List<VaultItem> listFull(String userId, String tag, String q);

    VaultItem create(String userId, VaultUpsert body);
    VaultItem update(String userId, String id, VaultUpsert body);

    VaultItem patchMeta(String userId, String id, VaultMetaPatch patch);

    // ??NEW: /items/{id}/content PATCH ???
    VaultItem patchContent(String userId, String id, JsonNode content);

    // ??NEW: /items/{id} PATCH ???怨〓㈃/怨≪꽑/諛곗뿴 ?ы븿)
    VaultItem patchItem(String userId, String id, VaultItemPatch patch);

    VaultItem getOwned(String userId, String id);
    void delete(String userId, String id);
}

