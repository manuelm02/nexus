package com.nexus.service;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 书签 URL 归一化服务。
 * <p>
 * 负责移除追踪参数、小写化域名、去除 fragment 和尾部斜杠，产出可比较的归一化 URL。
 * 归一化后的 URL 用于去重和统计分析，原始 URL 仍完整保留在数据库。
 * <p>
 * 追踪参数列表来源于常见广告/分析平台（Google Analytics、Facebook、HubSpot 等），
 * 经国内外实践验证，这些参数不影响页面内容展示。
 */
@Service
public class BookmarkUrlNormalizer {

    /** 需要从 URL 中移除的追踪参数集合（全部小写化，便于大小写不敏感匹配） */
    private static final Set<String> TRACKING_PARAMS = Set.of(
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "utm_referrer", "utm_reader", "utm_social", "utm_social_type", "utm_hashed_email",
            "fbclid", "gclid", "msclkid", "yclid", "wbraid", "gbraid", "ttclid", "twclid", "igshid",
            "ref", "source", "si", "spm",
            "mc_cid", "mc_eid",
            "_ga", "_gl", "_gcl_au", "_gcl_aw", "_gcl_dc", "_gcl_gb", "_gcl_gf", "_gcl_ha", "_gcl_awc",
            "_rdt_uuid",
            "_hsenc", "_hsmi",
            "_openstat",
            "_ke",
            "hsa_cam", "hsa_grp", "hsa_mt", "hsa_src", "hsa_ad", "hsa_acc", "hsa_net", "hsa_ver", "hsa_la",
            "s_kwcid",
            "ck_subscriber_id",
            "mkt_tok",
            "sc_campaign", "sc_channel", "sc_content", "sc_medium", "sc_outcome", "sc_geo", "sc_country",
            "ml_subscriber", "ml_subscriber_hash",
            "vero_id", "vero_conv",
            "wickedid",
            "oly_anon_id", "oly_enc_id"
    );

    /**
     * 归一化结果，包含归一化后的 URL、域名和被移除的追踪参数列表。
     */
    public record NormalizeResult(String normalizedUrl, String domain, List<String> removedParams) {
    }

    /**
     * 全量归一化 URL：小写化 host、移除追踪参数、移除 fragment、移除尾部斜杠。
     * 用于书签创建时的 URL 标准化以及分析/导入流程中的去重比对。
     *
     * @param url 原始 URL，必须以 http:// 或 https:// 开头
     * @return 归一化后的 URL 字符串
     * @throws IllegalArgumentException URL 为空或格式无效
     */
    public String normalize(String url) {
        return normalizeInternal(url, null);
    }

    /**
     * 仅提取 URL 中存在的追踪参数名称列表，不修改 URL。
     * 供前端展示"我们检测到 X 个追踪参数"使用。
     *
     * @param url 原始 URL
     * @return 追踪参数名称列表（已去重），若无则返回空列表
     */
    public List<String> extractTrackingParams(String url) {
        List<String> removed = new ArrayList<>();
        normalizeInternal(url, removed);
        return removed;
    }

    /**
     * 归一化 URL 并返回详细信息：归一化后的 URL、域名、被移除的追踪参数名称。
     * 用于需要完整审计信息的场景（如导入报告、去重分析）。
     *
     * @param url 原始 URL
     * @return 包含归一化结果、域名和移除参数的 NormalizeResult
     */
    public NormalizeResult normalizeWithDetail(String url) {
        List<String> removed = new ArrayList<>();
        String normalized = normalizeInternal(url, removed);
        String domain = extractDomain(url);
        return new NormalizeResult(normalized, domain, Collections.unmodifiableList(removed));
    }

    /**
     * 核心归一化逻辑。
     *
     * @param rawUrl         原始 URL
     * @param removedCollector 若不为 null，将被移除的追踪参数名加入此列表
     * @return 归一化后的 URL
     */
    private String normalizeInternal(String rawUrl, List<String> removedCollector) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalArgumentException("URL 不能为空");
        }

        URI uri;
        try {
            uri = new URI(rawUrl.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("URL 格式无效: " + rawUrl, e);
        }

        // 校验：必须有合法的 scheme 和 host
        if (uri.getScheme() == null || uri.getScheme().isBlank()) {
            throw new IllegalArgumentException("URL 缺少协议（http/https）: " + rawUrl);
        }
        if (uri.getHost() == null) {
            throw new IllegalArgumentException("URL 缺少有效域名: " + rawUrl);
        }

        String scheme = uri.getScheme().toLowerCase();
        // 小写化 host（保留其他部分不变）
        String host = uri.getHost().toLowerCase();
        int port = uri.getPort();
        String authority = host;
        if (port != -1) {
            authority = host + ":" + port;
        }

        // 移除 fragment（# 之后部分）
        String fragment = null;

        // 移除尾部斜杠（但保留根路径 "/"）
        String path = uri.getRawPath();
        if (path != null && path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }

        // 处理查询参数：保留非追踪参数，保持原始编码
        String rawQuery = uri.getRawQuery();
        String cleanedQuery = cleanQueryParams(rawQuery, removedCollector);

        try {
            return new URI(scheme, authority, path, cleanedQuery, fragment).toString();
        } catch (Exception e) {
            throw new IllegalArgumentException("归一化后的 URL 无法重建: " + rawUrl, e);
        }
    }

    /**
     * 清洗查询参数：移除追踪参数，保留有意义参数。
     * 保持参数原始编码不变，通过 URL 解码后判断是否需要移除。
     *
     * @param rawQuery         原始查询字符串（URL 编码形态）
     * @param removedCollector 若不为 null，收集被移除的追踪参数名
     * @return 清洗后的查询字符串，若所有参数都被移除则返回 null
     */
    private String cleanQueryParams(String rawQuery, List<String> removedCollector) {
        if (rawQuery == null || rawQuery.isEmpty()) {
            return null;
        }

        // 用 LinkedHashMap 保持参数顺序
        Map<String, String> keptPairs = new LinkedHashMap<>();

        for (String pair : rawQuery.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }

            int eqIdx = pair.indexOf('=');
            String rawName = (eqIdx >= 0) ? pair.substring(0, eqIdx) : pair;
            // URL 解码参数名用于比较追踪列表（追踪参数集合全部小写）
            String decodedName = URLDecoder.decode(rawName, StandardCharsets.UTF_8).toLowerCase();

            if (TRACKING_PARAMS.contains(decodedName)) {
                // 收集被移除的参数名
                if (removedCollector != null && !removedCollector.contains(decodedName)) {
                    removedCollector.add(decodedName);
                }
                continue;
            }

            // 保留非追踪参数，使用原始编码形式避免二次编码导致差异
            keptPairs.put(rawName, rawName + ((eqIdx >= 0) ? "=" + pair.substring(eqIdx + 1) : ""));
        }

        if (keptPairs.isEmpty()) {
            return null;
        }

        return String.join("&", keptPairs.values());
    }

    /**
     * 从 URL 中提取域名。
     *
     * @param url 原始 URL
     * @return 小写化的域名，解析失败则返回原始 URL 本身
     */
    private String extractDomain(String url) {
        try {
            URI uri = new URI(url.trim());
            String host = uri.getHost();
            return host != null ? host.toLowerCase() : url;
        } catch (Exception e) {
            return url;
        }
    }
}
