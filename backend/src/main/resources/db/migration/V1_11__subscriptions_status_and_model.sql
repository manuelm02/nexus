UPDATE subscriptions SET status = 'active' WHERE status = 'cancelled';

INSERT INTO workflow_llm_configs (id, workflow_type)
VALUES (gen_random_uuid()::text, 'subscriptions')
ON CONFLICT (workflow_type) DO NOTHING;
