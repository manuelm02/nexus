-- 将历史误用的 notes.obsidian.sub_folder 兼容迁移到 Mindbank 专属 key。
-- 不删除旧 key，避免未知历史代码或手工数据依赖被破坏。
INSERT INTO system_configs (id, config_key, config_val, description)
SELECT gen_random_uuid()::text,
       'mindbank.obsidian.sub_folder',
       config_val,
       'Mindbank Obsidian 子文件夹'
FROM system_configs
WHERE config_key = 'notes.obsidian.sub_folder'
  AND NOT EXISTS (
    SELECT 1 FROM system_configs WHERE config_key = 'mindbank.obsidian.sub_folder'
  );
