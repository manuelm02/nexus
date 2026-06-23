package com.nexus.adapter.note;

import com.nexus.service.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObsidianNoteAdapterTest {

    @Mock
    private SystemConfigService systemConfigService;

    private Path vault;
    private ObsidianNoteAdapter adapter;

    @BeforeEach
    void setUp() throws IOException {
        vault = Files.createTempDirectory("nexus-vault-");
        when(systemConfigService.get("notes.obsidian.vault_path")).thenReturn(vault.toString());
        adapter = new ObsidianNoteAdapter(systemConfigService);
    }

    @Test
    void archiveNoteMovesFileInsideVaultAndReturnsRelativePath() throws IOException {
        Path sourceDir = vault.resolve("Mindbank");
        Files.createDirectories(sourceDir);
        Files.writeString(sourceDir.resolve("orphan.md"), "# Orphan");

        String archivedPath = adapter.archiveNote("Mindbank/orphan.md", "_archive");

        assertThat(archivedPath).isEqualTo("_archive/orphan.md");
        assertThat(Files.exists(vault.resolve("Mindbank/orphan.md"))).isFalse();
        assertThat(Files.readString(vault.resolve("_archive/orphan.md"))).isEqualTo("# Orphan");
    }

    @Test
    void archiveNoteRejectsPathTraversal() {
        assertThatThrownBy(() -> adapter.archiveNote("../outside.md", "_archive"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("非法路径");
    }
}
