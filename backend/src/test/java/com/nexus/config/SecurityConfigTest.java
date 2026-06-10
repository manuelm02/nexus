package com.nexus.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// SecurityConfigTest 固化 API 未认证时的状态码，避免前端 refresh 逻辑被 403 绕过。
@SpringBootTest(classes = {SecurityConfig.class, SecurityConfigTest.ProtectedController.class})
@AutoConfigureMockMvc
@ImportAutoConfiguration(WebMvcAutoConfiguration.class)
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtConfig jwtConfig;

    @Test
    void protectedApiWithoutTokenReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/protected"))
            .andExpect(status().isUnauthorized());
    }

    @RestController
    static class ProtectedController {
        @GetMapping("/api/v1/protected")
        String protectedEndpoint() {
            return "ok";
        }
    }
}
