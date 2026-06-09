package com.nexus.config;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Spring Security 配置：无状态 JWT 认证，禁用 Session 和 CSRF。
 *
 * 认证流程：
 *   请求 → jwtAuthFilter 解析 Bearer token → 写入 SecurityContextHolder
 *   → authorizeHttpRequests 检查认证状态 → 进入 Controller
 *
 * 白名单：auth 接口、OpenAPI 文档无需认证，其余所有接口都需要有效 JWT。
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtConfig jwtConfig;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 纯 REST API，不需要 CSRF 防护（无 cookie 认证）
            .csrf(AbstractHttpConfigurer::disable)
            // 无状态：每个请求自带 JWT，不创建 HttpSession
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                // 前端只在 401 时执行 token refresh；未登录或 JWT 失效不能落到默认 403，否则会绕过 refresh 流程。
                .authenticationEntryPoint((req, res, authException) -> res.sendError(HttpServletResponse.SC_UNAUTHORIZED))
                .accessDeniedHandler((req, res, accessDeniedException) -> {
                    var auth = SecurityContextHolder.getContext().getAuthentication();
                    if (auth == null || auth instanceof AnonymousAuthenticationToken) {
                        res.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                    } else {
                        res.sendError(HttpServletResponse.SC_FORBIDDEN);
                    }
                })
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/auth/login",
                    "/api/v1/auth/refresh",
                    "/api/v1/auth/send-code",
                    "/api-docs/**",        // SpringDoc OpenAPI JSON
                    "/swagger-ui/**",
                    "/swagger-ui.html"
                ).permitAll()
                .anyRequest().authenticated()
            )
            // 在 UsernamePasswordAuthenticationFilter 之前运行 JWT 过滤器
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * JWT 认证过滤器：从 Authorization header 中提取 Bearer token，
     * 解析成功则将 userId 写入 SecurityContext（作为 principal）。
     *
     * token 解析失败时静默跳过（catch ignored），由后续的 authorizeHttpRequests
     * 检测到 SecurityContext 为空并返回 401，避免在过滤器层直接写响应造成响应污染。
     */
    @Bean
    public OncePerRequestFilter jwtAuthFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                String header = req.getHeader("Authorization");
                if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
                    String token = header.substring(7);
                    try {
                        Claims claims = jwtConfig.parseToken(token);
                        String userId = claims.getSubject();
                        String role = claims.get("role", String.class);
                        // principal 存 userId（字符串），credential 为 null（JWT 无需密码凭证）
                        var auth = new UsernamePasswordAuthenticationToken(
                            userId, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                        );
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    } catch (Exception ignored) {
                        // token 过期/签名错误/格式错误，不设置认证，后续由框架返回 401
                    }
                }
                chain.doFilter(req, res);
            }
        };
    }
}
