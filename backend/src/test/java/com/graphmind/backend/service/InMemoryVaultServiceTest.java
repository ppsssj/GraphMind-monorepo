package com.graphmind.backend.service;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryVaultServiceTest {

    private final InMemoryVaultService service = new InMemoryVaultService();
    private final ObjectMapper om = new ObjectMapper();

    @Test
    void createCurve3dKeepsContentAndDerivesPreviewFields() {
        JsonNode content = om.createObjectNode()
                .put("xExpr", "cos(t)")
                .put("yExpr", "sin(t)")
                .put("zExpr", "t")
                .put("tMin", 0)
                .put("tMax", Math.PI * 2)
                .put("samples", 480);

        VaultService.VaultUpsert body = new VaultService.VaultUpsert(
                "Curve",
                "curve3d",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of("3d"),
                content,
                null
        );

        var item = service.create("u1", body);

        assertEquals("curve3d", item.type());
        assertEquals(content, item.content());
        assertEquals(480, item.samples());
        assertEquals("x(t)=cos(t), y(t)=sin(t), z(t)=t", item.expr());
        assertEquals(1, service.listFull("u1", null, null).size());
    }

    @Test
    void createSurface3dKeepsRangesInsideContentAndDerivesExpr() {
        JsonNode content = om.createObjectNode()
                .put("expr", "sin(x)*cos(y)")
                .put("xMin", -4)
                .put("xMax", 4)
                .put("yMin", -3)
                .put("yMax", 3)
                .put("samples", 96);

        VaultService.VaultUpsert body = new VaultService.VaultUpsert(
                "Surface",
                "surface3d",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of("surface"),
                content,
                null
        );

        var item = service.create("u1", body);

        assertEquals("surface3d", item.type());
        assertEquals(content, item.content());
        assertEquals("sin(x)*cos(y)", item.expr());
        assertEquals(96, item.samples());
    }

    @Test
    void createArray3dInfersDimensionsFromContent() {
        JsonNode content = om.readTree("""
                [
                  [[1, 2], [3, 4]],
                  [[5, 6], [7, 8]],
                  [[9, 10], [11, 12]]
                ]
                """);

        VaultService.VaultUpsert body = new VaultService.VaultUpsert(
                "Array",
                "array3d",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of("array"),
                content,
                null
        );

        var item = service.create("u1", body);

        assertEquals("array3d", item.type());
        assertEquals(content, item.content());
        assertEquals(2, item.sizeX());
        assertEquals(2, item.sizeY());
        assertEquals(3, item.sizeZ());
        assertEquals("zyx", item.axisOrder());
    }
}
