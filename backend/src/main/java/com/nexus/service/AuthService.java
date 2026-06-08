package com.nexus.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.config.JwtConfig;
import com.nexus.dto.request.LoginRequest;
import com.nexus.dto.request.RefreshTokenRequest;
import com.nexus.dto.response.TokenResponse;
import com.nexus.entity.RefreshToken;
import com.nexus.entity.User;
import com.nexus.mapper.RefreshTokenMapper;
import com.nexus.mapper.UserMapper;

import lombok.RequiredArgsConstructor;

/**
 * 认证服务：负责登录、Token 刷新（轮换）和登出。
 *
 * Token 设计：
 * - access token：JWT，15分钟有效，携带 userId 和 role，由 JwtConfig 签发/解析
 * - refresh token：随机 UUID，30天有效，以 SHA-256 哈希形式存入 DB（不存明文）
 * 每次 refresh 都执行 Token Rotation（旧 token 作废，签发新 token），防止 replay 攻击
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final RefreshTokenMapper refreshTokenMapper;
    private final JwtConfig jwtConfig;
    private final PasswordEncoder passwordEncoder;

    /**
     * 用户名密码登录，验证通过后签发 access + refresh token。
     * 密码验证使用 BCrypt，不直接比对明文。
     */
    @Transactional
    public TokenResponse login(LoginRequest req) {
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, req.getUsername())
                .eq(User::getStatus, "active"));

        // 用户不存在和密码错误统一返回相同提示，防止用户名枚举攻击
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("用户名或密码错误");
        }

        return issueTokens(user, req.getDeviceType(), req.getDeviceInfo());
    }

    /**
     * 用 refresh token 换取新的 token 对（Token Rotation）。
     * DB 中存储的是 SHA-256 哈希，避免 token 泄露时可直接使用。
     * 旧 token 立即标记为已撤销，再用旧 token 刷新会失败。
     */
    @Transactional
    public TokenResponse refresh(RefreshTokenRequest req) {
        // 通过哈希值查找，而非明文，防止 DB 被拖库后 token 被复用
        String hash = sha256(req.getRefreshToken());
        RefreshToken rt = refreshTokenMapper.selectOne(new LambdaQueryWrapper<RefreshToken>()
                .eq(RefreshToken::getTokenHash, hash)
                .eq(RefreshToken::isRevoked, false));

        if (rt == null || rt.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("refresh_token 无效或已过期");
        }

        User user = userMapper.selectById(rt.getUserId());
        if (user == null || !"active".equals(user.getStatus())) {
            throw new IllegalArgumentException("用户不存在或已禁用");
        }

        // Token Rotation：作废旧 token，立即签发新 token
        rt.setRevoked(true);
        refreshTokenMapper.updateById(rt);

        return issueTokens(user, rt.getDeviceType(), rt.getDeviceInfo());
    }

    /**
     * 登出：将指定 refresh token 标记为已撤销。
     * access token 不作废（无状态，依赖其短有效期自然过期）。
     */
    @Transactional
    public void logout(String refreshToken) {
        String hash = sha256(refreshToken);
        RefreshToken rt = refreshTokenMapper.selectOne(new LambdaQueryWrapper<RefreshToken>()
                .eq(RefreshToken::getTokenHash, hash));
        if (rt != null) {
            rt.setRevoked(true);
            refreshTokenMapper.updateById(rt);
        }
    }

    /** 签发 access + refresh token 并更新用户最后登录时间 */
    private TokenResponse issueTokens(User user, String deviceType, String deviceInfo) {
        String accessToken = jwtConfig.generateAccessToken(user.getId(), user.getRole());

        // refresh token 明文只在这里出现一次，响应后不再持久化明文
        String rawRefreshToken = UUID.randomUUID().toString();
        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setTokenHash(sha256(rawRefreshToken));
        rt.setDeviceType(deviceType);
        rt.setDeviceInfo(deviceInfo);
        rt.setExpiresAt(LocalDateTime.now().plusSeconds(jwtConfig.getRefreshTokenExpiry()));
        rt.setRevoked(false);
        refreshTokenMapper.insert(rt);

        user.setLastLoginAt(LocalDateTime.now());
        userMapper.updateById(user);

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .expiresIn(jwtConfig.getAccessTokenExpiry())
                .tokenType("Bearer")
                .user(TokenResponse.UserInfo.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .nickname(user.getNickname())
                        .avatarUrl(user.getAvatarUrl())
                        .role(user.getRole())
                        .build())
                .build();
    }

    /** 返回 principal 中存储的 userId（SecurityContextHolder 的 principal 就是 userId 字符串） */
    public String getCurrentUserId(String principal) {
        return principal;
    }

    /** SHA-256 哈希，用于 refresh token 安全存储，返回 64 位小写十六进制字符串 */
    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 hash 失败", e);
        }
    }
}
