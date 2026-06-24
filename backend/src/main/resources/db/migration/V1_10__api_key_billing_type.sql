-- 新增 billing_type 列：按量计费 (pay_as_you_go) / 套餐型 (plan_based)，默认 plan_based
ALTER TABLE api_keys
  ADD COLUMN billing_type VARCHAR(20) NOT NULL DEFAULT 'plan_based';

-- 新增 month_start_balance 列，按量计费用于计算月消费 = 月初余额 + 当月充值 - 当前余额
ALTER TABLE api_keys
  ADD COLUMN month_start_balance NUMERIC(12,2);

-- 将已有的开启余额同步的 Key（DeepSeek 等）标记为按量计费
UPDATE api_keys
SET billing_type = 'pay_as_you_go'
WHERE api_fetch_enabled = true;

-- 初始化 month_start_balance：用 当前余额 + 已记录的月消费 近似月初余额
UPDATE api_keys
SET month_start_balance = COALESCE(remaining_balance, 0) + COALESCE(monthly_spend, 0)
WHERE billing_type = 'pay_as_you_go';

-- 清理套餐型的余额相关字段（列结构保留，只清数据）
UPDATE api_keys
SET remaining_balance = NULL,
    monthly_spend = 0,
    low_balance_notify = false,
    low_balance_threshold = NULL,
    api_fetch_enabled = false,
    api_last_fetched_at = NULL,
    api_balance_json = NULL
WHERE billing_type = 'plan_based';
