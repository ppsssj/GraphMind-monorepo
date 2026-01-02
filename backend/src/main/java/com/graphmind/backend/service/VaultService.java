package com.graphmind.backend.service;

import com.graphmind.backend.domain.VaultItem;
import com.graphmind.backend.domain.VaultItemSummary;
import com.graphmind.backend.domain.LinkRef;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

public interface VaultService {

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

    record VaultMetaPatch(
            String title,
            List<String> tags,
            String formula
    ) {}

    List<VaultItemSummary> listSummary(String userId, String tag, String q);
    List<VaultItem> listFull(String userId, String tag, String q);

    VaultItem create(String userId, VaultUpsert body);
    VaultItem update(String userId, String id, VaultUpsert body);

    // “제목/태그(+equation formula)”만 수정하는 편집 기능용
    VaultItem patchMeta(String userId, String id, VaultMetaPatch patch);

    VaultItem getOwned(String userId, String id);
    void delete(String userId, String id);
}
