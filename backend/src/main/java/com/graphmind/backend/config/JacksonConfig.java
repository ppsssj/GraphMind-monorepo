package com.graphmind.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        // ✅ 기본 ObjectMapper만 제공 (추가 설정 금지)
        return new ObjectMapper();
    }
}
