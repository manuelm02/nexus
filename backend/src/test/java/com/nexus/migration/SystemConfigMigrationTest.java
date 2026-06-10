package com.nexus.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class SystemConfigMigrationTest {

    @Test
    void renameModuleKeysMigrationIsRetainedAsNoOp() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V1_5__rename_module_keys.sql"));

        assertThat(sql).doesNotContain("UPDATE");
        assertThat(sql).contains("直接在 V1_2/V1_4 中统一模块命名");
    }
}
