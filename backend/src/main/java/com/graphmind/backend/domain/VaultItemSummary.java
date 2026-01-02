package com.graphmind.backend.domain;

import java.time.Instant;
import java.util.List;

/**
 * 목록용 경량 DTO: LeftPanel에 필요한 필드만.
 * (array3d는 content 없이도 sizeX/Y/Z로 dims 표시 가능)
 */
public record VaultItemSummary(
        String id,
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
        Instant updatedAt
) {}
