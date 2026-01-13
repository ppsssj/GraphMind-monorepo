package com.graphmind.backend.domain;

import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

/**
 * Vault????λ릺???⑥씪 由ъ냼??
 * - equation: formula ?ъ슜
 * - surface3d: expr ?ъ슜
 * - curve3d: samples ?ъ슜(?몃? x/y/z ?깆? content?????媛??
 * - array3d: axisOrder + sizeX/Y/Z ?ъ슜(?ㅻ뜲?댄꽣??content?????媛??
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

        // array3d meta (?꾩닚?꾩?留??쒖쇅?섏? ?딆쓬)
        String axisOrder,   // "zyx" | "xyz" ...
        Integer sizeX,
        Integer sizeY,
        Integer sizeZ,

        List<String> tags,

        /**
         * ??낅퀎 ?섏씠濡쒕뱶(?좏깮):
         * - equation: null 媛??
         * - curve3d: { x, y, z, tRange, ... }
         * - surface3d: { xRange, yRange, ... }
         * - array3d: 3以?諛곗뿴(Json)
         */
        JsonNode content,

        List<LinkRef> links,
        Instant updatedAt
) {}

