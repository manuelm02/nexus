-- V1_18: 预置 Phase 6 Mindbank Pipeline 所需的 3 个 workflow type
-- 注意：workflow_llm_configs.workflow_type 是 UNIQUE NOT NULL，LlmConfigService.updateWorkflowConfig
-- 要求 workflowType 必须已存在，否则抛 "工作流不存在" 异常。
-- V1_4 预置了 mindbank_extract/summary/chat（Phase 1-5 旧版），本批为 Phase 6 新拆分的 3 步。

INSERT INTO workflow_llm_configs (id, workflow_type) VALUES
(gen_random_uuid()::text, 'mindbank_classify'),
(gen_random_uuid()::text, 'mindbank_organize'),
(gen_random_uuid()::text, 'mindbank_condense')
ON CONFLICT (workflow_type) DO NOTHING;
