package com.nexus.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/** V1_10 订阅 UI 重构迁移脚本验证：新增列和分类表。 */
class SubscriptionRedesignMigrationTest {

    @Test
    void subscriptionsTableHasRedesignColumns() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V1_10__subscriptions_redesign.sql"));

        assertThat(sql).contains(
                "auto_renew",
                "archived",
                "remaining_balance",
                "monthly_spend",
                "recharge_records",
                "low_balance_notify",
                "low_balance_threshold"
        );
    }

    @Test
    void subscriptionCategoriesTableExistsWithRequiredColumns() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V1_10__subscriptions_redesign.sql"));

        assertThat(sql).contains(
                "CREATE TABLE IF NOT EXISTS subscription_categories",
                "id",
                "name",
                "created_at"
        );
    }
}
