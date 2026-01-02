package com.graphmind.backend.domain;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

/**
 * Vault에 저장되는 단일 리소스.
 * - equation: formula 사용
 * - surface3d: expr 사용
 * - curve3d: samples 사용(세부 x/y/z 등은 content에 저장 가능)
 * - array3d: axisOrder + sizeX/Y/Z 사용(실데이터는 content에 저장 가능)
 */
public record VaultItem(
        String id,
        String userId,
        String title,
        String type,        // equation | array3d | curve3d | surface3d

        // leftpanel preview fields
        String formula,     // equation
        String expr,        // surface3d or preview string
        Integer samples,    // curve3d / surface3d

        // array3d meta (후순위지만 제외하지 않음)
        String axisOrder,   // "zyx" | "xyz" ...
        Integer sizeX,
        Integer sizeY,
        Integer sizeZ,

        List<String> tags,

        /**
         * 타입별 페이로드(선택):
         * - equation: null 가능
         * - curve3d: { x, y, z, tRange, ... }
         * - surface3d: { xRange, yRange, ... }
         * - array3d: 3중 배열(Json)
         */
        JsonNode content,

        List<LinkRef> links,
        Instant updatedAt
) {}
