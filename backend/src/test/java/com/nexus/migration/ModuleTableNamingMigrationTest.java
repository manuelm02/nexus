package com.nexus.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ModuleTableNamingMigrationTest {

    @Test
    void coreModuleTablesUseCurrentModuleNames() throws Exception {
        List<Path> checkedFiles = List.of(
                Path.of("src/main/resources/db/migration/V1_2__init_core_modules.sql"),
                Path.of("src/main/java/com/nexus/entity/Todo.java"),
                Path.of("src/main/java/com/nexus/entity/InboxItem.java"),
                Path.of("src/main/java/com/nexus/entity/Translation.java"),
                Path.of("src/main/java/com/nexus/entity/Subscription.java"),
                Path.of("src/main/java/com/nexus/mapper/TodoMapper.java"),
                Path.of("src/main/java/com/nexus/mapper/SubscriptionMapper.java")
        );

        String combined = readAll(checkedFiles);

        assertThat(combined).contains(
                "CREATE TABLE todos",
                "CREATE TABLE inbox_items",
                "CREATE TABLE translations",
                "CREATE TABLE subscriptions",
                "CREATE TABLE coding_practice_notes",
                "CREATE TABLE coding_practice_note_contents"
        );
        assertThat(combined).doesNotContain(
                "CREATE TABLE focus",
                "CREATE TABLE fleeting",
                "CREATE TABLE prism",
                "CREATE TABLE ledger",
                "CREATE TABLE forge_notes",
                "CREATE TABLE forge_note_contents",
                "@TableName(\"focus\")",
                "@TableName(value = \"fleeting\"",
                "@TableName(\"prism\")",
                "@TableName(value = \"ledger\"",
                "FROM focus",
                "FROM ledger"
        );
    }

    @Test
    void subscriptionsPhase4MigrationDropsNotionColumnsAndKeepsDormantApiColumns() throws Exception {
        String coreSql = Files.readString(Path.of("src/main/resources/db/migration/V1_2__init_core_modules.sql"));
        String cleanupSql = Files.readString(Path.of("src/main/resources/db/migration/V1_9__subscriptions_phase4_cleanup.sql"));

        assertThat(coreSql).contains(
                "api_provider",
                "api_key_masked",
                "api_fetch_enabled",
                "api_last_fetched_at",
                "api_balance_json"
        );
        assertThat(cleanupSql).contains(
                "DROP COLUMN IF EXISTS notion_page_url",
                "DROP COLUMN IF EXISTS notion_synced",
                "DROP COLUMN IF EXISTS task_id"
        );
        assertThat(cleanupSql).doesNotContain(
                "DROP COLUMN IF EXISTS api_provider",
                "DROP COLUMN IF EXISTS api_key_masked",
                "DROP COLUMN IF EXISTS api_fetch_enabled",
                "DROP COLUMN IF EXISTS api_last_fetched_at",
                "DROP COLUMN IF EXISTS api_balance_json"
        );
    }

    private String readAll(List<Path> paths) throws Exception {
        StringBuilder result = new StringBuilder();
        for (Path path : paths) {
            result.append(Files.readString(path)).append('\n');
        }
        return result.toString();
    }
}
