package com.nexus.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class SystemConfigMigrationTest {

    @Test
    void initialSettingsUseCurrentWorkflowAndConfigKeys() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V1_4__init_settings_config.sql"));

        assertThat(sql).contains(
                "'subscriptions'",
                "'chat'",
                "'inbox'",
                "'mindbank_classify'",
                "'subscription.notify_days_before'",
                "'task.cleanup_days'"
        );
        assertThat(sql).doesNotContain(
                "'ledger'",
                "'prism'",
                "'fleeting'",
                "'focus'"
        );
    }
}
