package com.graphmind.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graphmind.backend.repo.TokenStore;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

@Component
public class AuthFilter extends OncePerRequestFilter {

    private final TokenStore tokenStore;
    private final ObjectMapper om = new ObjectMapper();

    public AuthFilter(TokenStore tokenStore) {
        this.tokenStore = tokenStore;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;

        String p = request.getRequestURI();
        String m = request.getMethod();

        // health / swagger
        if (p.equals("/health")) return true;
        if (p.startsWith("/v3/api-docs") || p.startsWith("/swagger-ui")) return true;

        // ✅ auth는 login/register만 예외 허용 (게스트 제거됨)
        if (p.equals("/api/v1/auth/login") && "POST".equalsIgnoreCase(m)) return true;
        if (p.equals("/api/v1/auth/register") && "POST".equalsIgnoreCase(m)) return true;

        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest req,
            HttpServletResponse res,
            FilterChain chain
    ) throws ServletException, IOException {

        String auth = req.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            unauthorized(res, "missing_token");
            return;
        }

        String token = auth.substring("Bearer ".length()).trim();
        if (token.isEmpty()) {
            unauthorized(res, "missing_token");
            return;
        }

        String userId = tokenStore.resolveUserId(token);
        if (userId == null) {
            unauthorized(res, "invalid_token");
            return;
        }

        req.setAttribute("userId", userId);
        chain.doFilter(req, res);
    }

    private void unauthorized(HttpServletResponse res, String code) throws IOException {
        res.setStatus(401);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        om.writeValue(res.getWriter(), Map.of("error", code));
    }
}
