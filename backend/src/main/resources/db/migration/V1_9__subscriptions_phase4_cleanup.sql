ALTER TABLE subscriptions
    DROP COLUMN IF EXISTS notion_page_url,
    DROP COLUMN IF EXISTS notion_synced,
    DROP COLUMN IF EXISTS task_id;
