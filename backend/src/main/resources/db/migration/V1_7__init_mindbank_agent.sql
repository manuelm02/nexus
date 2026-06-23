-- Mindbank Agent 系统：巡检/融合任务记录 + 执行步骤轨迹 + 建议审批（human-in-the-loop）

CREATE TABLE mindbank_agent_tasks (
    id              BIGSERIAL PRIMARY KEY,
    agent_type      VARCHAR(30) NOT NULL,       -- 'inspect' | 'merge_check' | 'qa'
    trigger_type    VARCHAR(20) NOT NULL,        -- 'manual' | 'auto'
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending -> running -> awaiting_approval -> done / failed
    workspace_id    BIGINT REFERENCES mindbank_workspaces(id) ON DELETE SET NULL,
    summary         TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE mindbank_agent_steps (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES mindbank_agent_tasks(id) ON DELETE CASCADE,
    step_index      INT NOT NULL,
    thought         TEXT,
    tool_called     VARCHAR(100),
    tool_input      JSONB,
    tool_output     JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE mindbank_agent_suggestions (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES mindbank_agent_tasks(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(40) NOT NULL,
                    -- split_note / merge_workspace / resplit_workspace / fix_index / orphan_note
    description     TEXT NOT NULL,
    affected_notes  JSONB,
    proposed_action JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending / accepted / ignored
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
