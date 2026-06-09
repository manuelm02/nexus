-- 仅迁移配置层命名；历史表名由已应用的 V1_2 迁移创建，不能直接修改。
UPDATE workflow_llm_configs
SET workflow_type = 'translate'
WHERE workflow_type = 'prism'
  AND NOT EXISTS (
      SELECT 1 FROM workflow_llm_configs WHERE workflow_type = 'translate'
  );

UPDATE system_configs
SET key = 'todo.archive_days', description = 'ToDo 完成后归档天数'
WHERE key = 'focus.archive_days'
  AND NOT EXISTS (
      SELECT 1 FROM system_configs WHERE key = 'todo.archive_days'
  );

UPDATE system_configs
SET key = 'todo.rollover_time', description = '每日 ToDo Rollover 时间'
WHERE key = 'focus.rollover_time'
  AND NOT EXISTS (
      SELECT 1 FROM system_configs WHERE key = 'todo.rollover_time'
  );

UPDATE system_configs
SET key = 'subscription.notify_days_before'
WHERE key = 'ledger.notify_days_before'
  AND NOT EXISTS (
      SELECT 1 FROM system_configs WHERE key = 'subscription.notify_days_before'
  );
