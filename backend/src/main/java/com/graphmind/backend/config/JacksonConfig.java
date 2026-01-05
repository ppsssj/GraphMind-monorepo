package com.graphmind.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper om = new ObjectMapper();
        // Instant / LocalDateTime 등 Java time 직렬화 지원
        om.registerModule(new JavaTimeModule());
        // 2026-01-05T... 형태로 내보내기(타임스탬프 숫자 방지)
        om.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return om;
    }
}
