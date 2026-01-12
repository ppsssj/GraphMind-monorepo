package com.graphmind.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.graphmind.backend.domain.LinkRef;
import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;

import java.util.List;

/**
 * Vault 비즈니스 로직 인터페이스.
 *
 * ✅ 추가:
 * - patchContent: 타입별 payload(content)만 부분 업데이트
 * - patchItem: curve3d/surface3d/array3d 등 타입별 메타+payload를 부분 업데이트
 *
 * 프론트에서 PATCH를 보내는데 405/404가 뜨는 문제를 해결하려면
 * Controller + Service + Implementation(InMemoryVaultService 등)에 이 메서드들이 구현되어야 합니다.
 */
public interface VaultService {

    /**
     * 생성/전체 갱신(Upsert) 바디.
     * - equation: formula 사용
     * - surface3d: expr 사용
     * - curve3d: samples 사용(세부 x/y/z 등은 content에 저장)
     * - array3d: axisOrder + sizeX/Y/Z 사용(실데이터는 content에 저장)
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
     * “제목/태그(+equation formula)”만 수정하는 편집 기능용.
     * (기존 프론트 patchVaultMeta 호환)
     */
    record VaultMetaPatch(
            String title,
            List<String> tags,
            String formula
    ) {}

    /**
     * 부분 업데이트용(선택 필드만 채워서 PATCH).
     * - curve3d / surface3d / array3d 등에서도 동일하게 사용
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

    // ✅ NEW: /items/{id}/content PATCH 대응
    VaultItem patchContent(String userId, String id, JsonNode content);

    // ✅ NEW: /items/{id} PATCH 대응(곡면/곡선/배열 포함)
    VaultItem patchItem(String userId, String id, VaultItemPatch patch);

    VaultItem getOwned(String userId, String id);
    void delete(String userId, String id);
}
