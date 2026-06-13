package com.nexus.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * BookmarkUrlNormalizer 单元测试。
 * 覆盖追踪参数移除、host 小写化、fragment 移除、尾部斜杠处理等核心归一化逻辑。
 */
class BookmarkUrlNormalizerTest {

    private BookmarkUrlNormalizer normalizer;

    @BeforeEach
    void setUp() {
        normalizer = new BookmarkUrlNormalizer();
    }

    // ======================== 追踪参数移除 ========================

    @Test
    void shouldRemoveUtmSource() {
        String result = normalizer.normalize("https://example.com/page?utm_source=google&q=test");
        assertThat(result).isEqualTo("https://example.com/page?q=test");
    }

    @Test
    void shouldRemoveFbclid() {
        String result = normalizer.normalize("https://example.com/article?fbclid=abc123");
        assertThat(result).isEqualTo("https://example.com/article");
    }

    @Test
    void shouldRemoveMultipleTrackingParams() {
        String result = normalizer.normalize(
                "https://shop.example.com/product?utm_source=email&utm_medium=cpc&utm_campaign=sale&fbclid=xyz&gclid=abc");
        assertThat(result).isEqualTo("https://shop.example.com/product");
    }

    @Test
    void shouldRemoveTrackingParamsButKeepNonTrackingParams() {
        String result = normalizer.normalize(
                "https://example.com/search?utm_source=twitter&q=java&page=2");
        assertThat(result).isEqualTo("https://example.com/search?q=java&page=2");
    }

    @Test
    void shouldRemoveOnlyTrackingParamsWithAllTrackingParams() {
        String result = normalizer.normalize("https://example.com/page?utm_source=1&utm_medium=2&fbclid=3");
        assertThat(result).isEqualTo("https://example.com/page");
    }

    // ======================== host 小写化 ========================

    @Test
    void shouldLowercaseHost() {
        String result = normalizer.normalize("https://EXAMPLE.COM/Page?Q=Search");
        // host 小写化，路径和查询参数保留原始大小写
        assertThat(result).isEqualTo("https://example.com/Page?Q=Search");
    }

    // ======================== fragment 移除 ========================

    @Test
    void shouldRemoveFragment() {
        String result = normalizer.normalize("https://example.com/page#section-2");
        assertThat(result).isEqualTo("https://example.com/page");
    }

    @Test
    void shouldRemoveFragmentWithQueryParams() {
        String result = normalizer.normalize("https://example.com/page?q=test#anchor");
        assertThat(result).isEqualTo("https://example.com/page?q=test");
    }

    // ======================== 保留非追踪参数 ========================

    @Test
    void shouldKeepNonTrackingQueryParams() {
        String result = normalizer.normalize("https://example.com/search?q=test");
        assertThat(result).isEqualTo("https://example.com/search?q=test");
    }

    @Test
    void shouldHandleNoParams() {
        String result = normalizer.normalize("https://example.com/page");
        assertThat(result).isEqualTo("https://example.com/page");
    }

    // ======================== 尾部斜杠处理 ========================

    @Test
    void shouldRemoveTrailingSlash() {
        String result = normalizer.normalize("https://example.com/page/");
        assertThat(result).isEqualTo("https://example.com/page");
    }

    @Test
    void shouldPreserveRootPathSingleSlash() {
        // 根路径 "/" 不移除尾部斜杠（因为长度=1），保留原样
        String result = normalizer.normalize("https://example.com/");
        assertThat(result).isEqualTo("https://example.com/");
    }

    // ======================== 协议和端口 ========================

    @Test
    void shouldHandleHttpsProtocol() {
        String result = normalizer.normalize("https://secure.example.com/login");
        assertThat(result).isEqualTo("https://secure.example.com/login");
    }

    @Test
    void shouldHandlePort() {
        String result = normalizer.normalize("https://example.com:8080/api/data?utm_source=app");
        assertThat(result).isEqualTo("https://example.com:8080/api/data");
    }

    // ======================== Gclid 相关参数 ========================

    @Test
    void shouldRemoveGclid() {
        String result = normalizer.normalize("https://example.com?gclid=Cj0KCQiA&q=search");
        assertThat(result).isEqualTo("https://example.com?q=search");
    }

    @Test
    void shouldRemoveMsclkid() {
        String result = normalizer.normalize("https://example.com?msclkid=abc123&ref=sidebar");
        assertThat(result).isEqualTo("https://example.com");
    }

    @Test
    void shouldRemoveGbraidAndWbraid() {
        String result = normalizer.normalize("https://example.com/product?gbraid=abc&wbraid=def&id=42");
        assertThat(result).isEqualTo("https://example.com/product?id=42");
    }

    // ======================== extractTrackingParams ========================

    @Test
    void extractTrackingParamsShouldListRemovedParams() {
        List<String> params = normalizer.extractTrackingParams(
                "https://example.com/page?utm_source=google&fbclid=abc&q=test&gclid=xyz");
        assertThat(params).containsExactlyInAnyOrder("utm_source", "fbclid", "gclid");
    }

    @Test
    void extractTrackingParamsShouldReturnEmptyWhenNone() {
        List<String> params = normalizer.extractTrackingParams(
                "https://example.com/page?q=test&page=1");
        assertThat(params).isEmpty();
    }

    @Test
    void extractTrackingParamsShouldReturnEmptyWhenNoQueryString() {
        List<String> params = normalizer.extractTrackingParams("https://example.com/page");
        assertThat(params).isEmpty();
    }

    // ======================== normalizeWithDetail ========================

    @Test
    void normalizeWithDetailShouldReturnFullInfo() {
        BookmarkUrlNormalizer.NormalizeResult result = normalizer.normalizeWithDetail(
                "https://EXAMPLE.COM/article/?utm_source=newsletter&fbclid=abc#comments");

        assertThat(result.normalizedUrl()).isEqualTo("https://example.com/article");
        assertThat(result.domain()).isEqualTo("example.com");
        assertThat(result.removedParams()).containsExactlyInAnyOrder("utm_source", "fbclid");
    }

    @Test
    void normalizeWithDetailShouldHandleNoTrackingParams() {
        BookmarkUrlNormalizer.NormalizeResult result = normalizer.normalizeWithDetail(
                "https://blog.example.com/post?category=tech");

        assertThat(result.normalizedUrl()).isEqualTo("https://blog.example.com/post?category=tech");
        assertThat(result.domain()).isEqualTo("blog.example.com");
        assertThat(result.removedParams()).isEmpty();
    }

    // ======================== 边界情况 ========================

    @Test
    void shouldHandleComplexMixedParams() {
        // spm 是阿里系追踪参数，si 是短追踪参数
        String result = normalizer.normalize(
                "https://detail.example.com/item?id=100&spm=a1z09.2&si=456&ref=home");
        assertThat(result).isEqualTo("https://detail.example.com/item?id=100");
    }

    @Test
    void shouldHandleHubspotParams() {
        String result = normalizer.normalize(
                "https://blog.example.com/post?_hsenc=bWFpbD0x&_hsmi=123&article_id=42");
        assertThat(result).isEqualTo("https://blog.example.com/post?article_id=42");
    }

    @Test
    void shouldHandleScMarketingCloudParams() {
        String result = normalizer.normalize(
                "https://example.com/landing?sc_campaign=launch&sc_channel=email&sc_content=cta&sc_medium=blog&sc_outcome=click&sc_geo=us&sc_country=USA&lead_id=123");
        assertThat(result).isEqualTo("https://example.com/landing?lead_id=123");
    }

    @Test
    void shouldThrowOnNullUrl() {
        assertThatThrownBy(() -> normalizer.normalize(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URL 不能为空");
    }

    @Test
    void shouldThrowOnEmptyUrl() {
        assertThatThrownBy(() -> normalizer.normalize("   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URL 不能为空");
    }

    @Test
    void shouldThrowOnInvalidUrl() {
        assertThatThrownBy(() -> normalizer.normalize("not-a-valid-url"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URL 缺少协议");
    }
}
