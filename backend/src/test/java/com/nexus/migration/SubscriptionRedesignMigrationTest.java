package com.nexus.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/** 订阅与 Panel Hub 初始化 schema 验证：历史重构列已合并进当前保留的 Flyway 初始化脚本。 */
class SubscriptionRedesignMigrationTest {

    @Test
    void subscriptionsTableHasRedesignColumns() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V1_2__init_core_modules.sql"));

        assertThat(sql).contains(
                "auto_renew",
                "archived",
                "remaining_balance",
                "monthly_spend",
                "low_balance_notify",
                "low_balance_threshold"
        );
        assertThat(sql).doesNotContain("recharge_records");
    }

    @Test
    void subscriptionCategoriesTableExistsWithRequiredColumns() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V1_2__init_core_modules.sql"));

        assertThat(sql).contains(
                "CREATE TABLE subscription_categories",
                "id",
                "name",
                "created_at"
        );
    }

    @Test
    void panelHubApiKeyTablesExistWithLedgerAndBalanceHistory() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V1_8__panel_hub_api_keys_and_credentials.sql"));

        assertThat(sql).contains(
                "CREATE TABLE api_keys",
                "api_fetch_enabled",
                "CREATE TABLE api_key_ledger_entries",
                "CREATE TABLE api_key_balance_snapshots",
                "CREATE TABLE credentials"
        );
    }
}
