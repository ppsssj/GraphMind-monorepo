package com.graphmind.backend.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class VaultFlowIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void vaultEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/vault/items"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void fullVaultFlowPreservesStudioPayloads() throws Exception {
        String email = "vault-flow-" + UUID.randomUUID() + "@example.com";
        AuthSession auth = register(email, "password123!");

        String curveId = createVaultItem(auth, Map.of(
                "type", "curve3d",
                "title", "Curve",
                "tags", new String[]{"3d", "curve"},
                "samples", 480,
                "content", Map.of(
                        "xExpr", "cos(t)",
                        "yExpr", "sin(t)",
                        "zExpr", "t",
                        "tMin", 0,
                        "tMax", Math.PI * 2,
                        "tRange", new double[]{0, Math.PI * 2},
                        "samples", 480
                )
        ));

        createVaultItem(auth, Map.of(
                "type", "surface3d",
                "title", "Surface",
                "samples", 96,
                "content", Map.of(
                        "expr", "sin(x)*cos(y)",
                        "xMin", -4,
                        "xMax", 4,
                        "yMin", -3,
                        "yMax", 3,
                        "xRange", new int[]{-4, 4},
                        "yRange", new int[]{-3, 3},
                        "samples", 96
                )
        ));

        createVaultItem(auth, Map.of(
                "type", "array3d",
                "title", "Array",
                "content", new int[][][]{
                        {{1, 2}, {3, 4}},
                        {{5, 6}, {7, 8}}
                }
        ));

        String fullListBody = mockMvc.perform(request(HttpMethod.GET, "/api/v1/vault/items")
                        .param("view", "full")
                        .header("Authorization", "Bearer " + auth.token())
                        .requestAttr("userId", auth.userId()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode fullList = objectMapper.readTree(fullListBody);
        assertTrue(fullList.isArray());
        assertEquals(3, fullList.size());

        boolean foundCurve = false;
        boolean foundSurface = false;
        boolean foundArray = false;

        for (JsonNode item : fullList) {
            String type = item.path("type").asText();
            JsonNode content = item.path("content");
            if ("curve3d".equals(type)) {
                foundCurve = true;
                assertEquals("cos(t)", content.path("xExpr").asText());
                assertEquals("sin(t)", content.path("yExpr").asText());
                assertEquals("t", content.path("zExpr").asText());
            } else if ("surface3d".equals(type)) {
                foundSurface = true;
                assertEquals("sin(x)*cos(y)", content.path("expr").asText());
                assertEquals(-4, content.path("xMin").asInt());
                assertEquals(4, content.path("xMax").asInt());
            } else if ("array3d".equals(type)) {
                foundArray = true;
                assertTrue(content.isArray());
                assertEquals(2, item.path("sizeX").asInt());
                assertEquals(2, item.path("sizeY").asInt());
                assertEquals(2, item.path("sizeZ").asInt());
            }
        }

        assertTrue(foundCurve);
        assertTrue(foundSurface);
        assertTrue(foundArray);

        String curveBody = mockMvc.perform(request(HttpMethod.GET, "/api/v1/vault/items/{id}", curveId)
                        .header("Authorization", "Bearer " + auth.token())
                        .requestAttr("userId", auth.userId()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode curve = objectMapper.readTree(curveBody);
        assertEquals("curve3d", curve.path("type").asText());
        assertEquals("cos(t)", curve.path("content").path("xExpr").asText());
        assertEquals("x(t)=cos(t), y(t)=sin(t), z(t)=t", curve.path("expr").asText());
    }

    private AuthSession register(String email, String password) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);
        body.put("displayName", "Tester");

        String response = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(response);
        String token = json.path("token").asText();
        String userId = json.path("user").path("id").asText();
        assertFalse(token.isBlank());
        assertFalse(userId.isBlank());
        return new AuthSession(token, userId);
    }

    private String createVaultItem(AuthSession auth, Map<String, Object> body) throws Exception {
        String response = mockMvc.perform(post("/api/v1/vault/items")
                        .header("Authorization", "Bearer " + auth.token())
                        .requestAttr("userId", auth.userId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(response);
        String id = json.path("id").asText();
        assertFalse(id.isBlank());
        return id;
    }

    private record AuthSession(String token, String userId) {}
}
