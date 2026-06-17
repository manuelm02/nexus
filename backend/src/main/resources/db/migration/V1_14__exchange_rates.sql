-- V1_14: 各币种兑 CNY 的实时汇率缓存，避免每次请求都调用外部汇率 API

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency VARCHAR(8) PRIMARY KEY,
    rate_to_cny NUMERIC(14,6) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
