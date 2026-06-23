package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.nexus.dto.request.ApiKeyConsumeRequest;
import com.nexus.dto.request.ApiKeyCreateRequest;
import com.nexus.dto.request.ApiKeyRechargeRequest;
import com.nexus.dto.request.ApiKeyUpdateRequest;
import com.nexus.dto.response.ApiKeyResponse;
import com.nexus.entity.ApiKey;
import com.nexus.entity.ApiKeyBalanceSnapshot;
import com.nexus.entity.ApiKeyLedgerEntry;
import com.nexus.integration.balance.DeepSeekBalanceClient;
import com.nexus.integration.balance.ProviderBalanceResult;
import com.nexus.mapper.ApiKeyBalanceSnapshotMapper;
import com.nexus.mapper.ApiKeyLedgerEntryMapper;
import com.nexus.mapper.ApiKeyMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/** API Key 保险箱服务：管理密钥的加密存储、余额同步、充消流水、余额快照和低余额告警 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private final ApiKeyMapper apiKeyMapper;
    private final ApiKeyLedgerEntryMapper ledgerMapper;
    private final ApiKeyBalanceSnapshotMapper balanceSnapshotMapper;
    private final LlmConfigService llmConfigService;
    private final DeepSeekBalanceClient deepSeekBalanceClient;

    /**
     * 列出所有非归档 API Key，按创建时间倒序。
     */
    public List<ApiKeyResponse> list() {
        return apiKeyMapper.selectList(new LambdaQueryWrapper<ApiKey>()
                .eq(ApiKey::isArchived, false)
                .orderByDesc(ApiKey::getCreatedAt))
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * 列出所有已归档 API Key。
     */
    public List<ApiKeyResponse> listArchived() {
        return apiKeyMapper.selectList(new LambdaQueryWrapper<ApiKey>()
                .eq(ApiKey::isArchived, true)
                .orderByDesc(ApiKey::getCreatedAt))
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * 创建 API Key：加密存储明文 Key → 可选立即同步余额（仅支持 deepseek Provider）。
     * 若同步失败，整个事务回滚，避免用户拿到一个"余额未知"的 Key。
     */
    @Transactional
    public ApiKeyResponse create(@Valid ApiKeyCreateRequest req) {
        ApiKey entity = new ApiKey();
        entity.setLabel(req.getLabel());
        entity.setProvider(req.getProvider().toLowerCase());
        entity.setEncryptedKey(llmConfigService.encrypt(req.getApiKey()));
        entity.setBaseUrl(req.getBaseUrl());
        entity.setStatus("active");
        entity.setPlanName(req.getPlanName());
        entity.setPlanExpireDate(req.getPlanExpireDate());
        entity.setSubscriptionId(req.getSubscriptionId());
        entity.setMonthlySpend(BigDecimal.ZERO);
        entity.setLowBalanceNotify(Boolean.TRUE.equals(req.getLowBalanceNotify()));
        entity.setLowBalanceThreshold(req.getLowBalanceThreshold());
        entity.setApiFetchEnabled("deepseek".equalsIgnoreCase(req.getProvider()));
        entity.setNotes(req.getNotes());
        entity.setArchived(false);

        apiKeyMapper.insert(entity);

        // 支持余额自动查询的 Provider 创建后立即同步一次
        if (entity.isApiFetchEnabled()) {
            syncBalanceInternal(entity);
        }

        return toResponse(entity);
    }

    /**
     * PATCH 语义更新 API Key：只更新非 null 字段；apiKey 若有值则重新加密。
     */
    public ApiKeyResponse update(String id, ApiKeyUpdateRequest req) {
        ApiKey entity = getOrThrow(id);
        if (req.getLabel() != null) entity.setLabel(req.getLabel());
        if (req.getProvider() != null) entity.setProvider(req.getProvider().toLowerCase());
        if (req.getApiKey() != null) entity.setEncryptedKey(llmConfigService.encrypt(req.getApiKey()));
        if (req.getBaseUrl() != null) entity.setBaseUrl(req.getBaseUrl());
        if (req.getStatus() != null) entity.setStatus(req.getStatus());
        if (req.getPlanName() != null) entity.setPlanName(req.getPlanName());
        if (req.getPlanExpireDate() != null) entity.setPlanExpireDate(req.getPlanExpireDate());
        if (req.getSubscriptionId() != null) entity.setSubscriptionId(req.getSubscriptionId());
        if (req.getLowBalanceNotify() != null) entity.setLowBalanceNotify(req.getLowBalanceNotify());
        if (req.getLowBalanceThreshold() != null) entity.setLowBalanceThreshold(req.getLowBalanceThreshold());
        if (req.getArchived() != null) entity.setArchived(req.getArchived());
        if (req.getNotes() != null) entity.setNotes(req.getNotes());
        apiKeyMapper.updateById(entity);
        return toResponse(entity);
    }

    /**
     * 删除 API Key。
     */
    public void delete(String id) {
        getOrThrow(id);
        apiKeyMapper.deleteById(id);
    }

    /**
     * 充值：余额累加 + 写入 recharge 流水。
     * apiFetchEnabled 账户的 remainingBalance 不受充值影响（以 API 同步为真值），仅写流水用于记账。
     */
    @Transactional
    public ApiKeyResponse recharge(String id, ApiKeyRechargeRequest req) {
        ApiKey entity = getOrThrow(id);
        BigDecimal currentBalance = entity.getRemainingBalance() != null ? entity.getRemainingBalance() : BigDecimal.ZERO;

        if (!entity.isApiFetchEnabled()) {
            BigDecimal newBalance = currentBalance.add(req.getAmount());
            entity.setRemainingBalance(newBalance);
            apiKeyMapper.updateById(entity);
            writeLedgerEntry(id, "recharge", req.getAmount(), newBalance, req.getNote(),
                    req.getDate() != null ? req.getDate() : LocalDate.now());
        } else {
            BigDecimal balanceAfter = currentBalance.add(req.getAmount());
            writeLedgerEntry(id, "recharge", req.getAmount(), balanceAfter, req.getNote(),
                    req.getDate() != null ? req.getDate() : LocalDate.now());
        }

        return toResponse(entity);
    }

    /**
     * 消费记录：余额扣减 + 月消费累加 + 写入 consume 流水。
     * apiFetchEnabled 账户的 remainingBalance 不受消费影响（以 API 同步为真值），仅写流水用于记账。
     */
    @Transactional
    public ApiKeyResponse consume(String id, ApiKeyConsumeRequest req) {
        ApiKey entity = getOrThrow(id);
        BigDecimal currentBalance = entity.getRemainingBalance() != null ? entity.getRemainingBalance() : BigDecimal.ZERO;
        BigDecimal currentSpend = entity.getMonthlySpend() != null ? entity.getMonthlySpend() : BigDecimal.ZERO;
        entity.setMonthlySpend(currentSpend.add(req.getAmount()));

        if (!entity.isApiFetchEnabled()) {
            BigDecimal newBalance = currentBalance.subtract(req.getAmount());
            entity.setRemainingBalance(newBalance);
            apiKeyMapper.updateById(entity);
            writeLedgerEntry(id, "consume", req.getAmount(), newBalance, req.getNote(), LocalDate.now());
        } else {
            apiKeyMapper.updateById(entity);
            BigDecimal balanceAfter = currentBalance.subtract(req.getAmount());
            writeLedgerEntry(id, "consume", req.getAmount(), balanceAfter, req.getNote(), LocalDate.now());
        }

        return toResponse(entity);
    }

    /**
     * 手动刷新指定 API Key 的 Provider 余额。
     */
    @Transactional
    public ApiKeyResponse syncBalance(String id) {
        ApiKey entity = getOrThrow(id);
        if (!entity.isApiFetchEnabled()) {
            throw new IllegalStateException("该 API Key 不支持自动余额查询");
        }
        syncBalanceInternal(entity);
        return toResponse(entity);
    }

    /**
     * 批量同步所有开启了余额查询的活跃 API Key；单条失败不影响其余。
     */
    public int syncAllEnabledBalances() {
        List<ApiKey> targets = apiKeyMapper.selectList(new LambdaQueryWrapper<ApiKey>()
                .eq(ApiKey::isApiFetchEnabled, true)
                .eq(ApiKey::isArchived, false));
        int success = 0;
        for (ApiKey entity : targets) {
            try {
                syncBalanceInternal(entity);
                success++;
            } catch (Exception e) {
                log.warn("API Key [{}] 余额同步失败: {}", entity.getLabel(), e.getMessage());
            }
        }
        return success;
    }

    /**
     * 核心余额同步方法：解密 Key → 调用 Provider 余额接口 → 覆盖 remainingBalance → 写入快照。
     * apiFetchEnabled 账户的 remainingBalance 以 Provider 返回值为唯一真值，不与流水累加结果叠加。
     */
    private void syncBalanceInternal(ApiKey entity) {
        String plainKey = llmConfigService.decrypt(entity.getEncryptedKey());
        ProviderBalanceResult result = switch (entity.getProvider()) {
            case "deepseek" -> deepSeekBalanceClient.fetchBalance(plainKey);
            default -> throw new IllegalStateException("不支持的余额查询 Provider: " + entity.getProvider());
        };

        entity.setRemainingBalance(result.balance());
        entity.setApiBalanceJson(result.raw());
        entity.setApiLastFetchedAt(LocalDateTime.now());

        // 余额归零时标记为耗尽
        if (result.balance().compareTo(BigDecimal.ZERO) <= 0) {
            entity.setStatus("exhausted");
        }

        apiKeyMapper.updateById(entity);

        ApiKeyBalanceSnapshot snapshot = new ApiKeyBalanceSnapshot();
        snapshot.setApiKeyId(entity.getId());
        snapshot.setBalance(result.balance());
        snapshot.setCurrency(result.currency());
        snapshot.setRawJson(result.raw());
        snapshot.setSnapshottedAt(LocalDateTime.now());
        balanceSnapshotMapper.insert(snapshot);
    }

    /**
     * 获取最近 N 条充值/消费流水记录（上限 100，防止恶意大数查询）。
     */
    public List<ApiKeyLedgerEntry> getLedger(String id, int limit) {
        getOrThrow(id);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        return ledgerMapper.selectList(new LambdaQueryWrapper<ApiKeyLedgerEntry>()
                .eq(ApiKeyLedgerEntry::getApiKeyId, id)
                .orderByDesc(ApiKeyLedgerEntry::getCreatedAt)
                .last("LIMIT " + safeLimit));
    }

    /**
     * 获取最近 N 天的余额快照（上限 365 天，用于趋势图）。
     */
    public List<ApiKeyBalanceSnapshot> getBalanceHistory(String id, int days) {
        getOrThrow(id);
        int safeDays = Math.min(Math.max(days, 1), 365);
        return balanceSnapshotMapper.selectList(new LambdaQueryWrapper<ApiKeyBalanceSnapshot>()
                .eq(ApiKeyBalanceSnapshot::getApiKeyId, id)
                .ge(ApiKeyBalanceSnapshot::getSnapshottedAt, LocalDateTime.now().minusDays(safeDays))
                .orderByAsc(ApiKeyBalanceSnapshot::getSnapshottedAt));
    }

    /**
     * 查找低余额告警项：lowBalanceNotify=true && 余额 < 阈值 && 未归档。
     */
    public List<ApiKey> findLowBalance() {
        List<ApiKey> all = apiKeyMapper.selectList(new LambdaQueryWrapper<ApiKey>()
                .eq(ApiKey::isLowBalanceNotify, true)
                .eq(ApiKey::isArchived, false));

        return all.stream()
                .filter(e -> e.getRemainingBalance() != null
                        && e.getLowBalanceThreshold() != null
                        && e.getRemainingBalance().compareTo(e.getLowBalanceThreshold()) < 0)
                .collect(Collectors.toList());
    }

    /**
     * 月初重置所有 API Key 的月消费额。
     */
    public int resetMonthlySpend() {
        return apiKeyMapper.update(null, new LambdaUpdateWrapper<ApiKey>()
                .set(ApiKey::getMonthlySpend, BigDecimal.ZERO));
    }

    /**
     * 解密 API Key 返回明文，供前端"一键复制"使用。
     */
    public String revealKey(String id) {
        ApiKey entity = getOrThrow(id);
        return llmConfigService.decrypt(entity.getEncryptedKey());
    }

    /**
     * 将实体转为响应对象，对密文直接打码（不解密，避免列表查询时批量解密 N 次）。
     * revealKey() 方法保持解密能力，供用户主动请求。
     */
    private ApiKeyResponse toResponse(ApiKey entity) {
        String maskedKey = maskKey(entity.getEncryptedKey());
        return ApiKeyResponse.from(entity, maskedKey);
    }

    /**
     * 密文打码：少于 10 位全部打码，否则取前 5 位 + ... + 后 4 位。
     */
    private String maskKey(String encryptedKey) {
        if (encryptedKey == null || encryptedKey.length() <= 9) return "****";
        return encryptedKey.substring(0, 5) + "..." + encryptedKey.substring(encryptedKey.length() - 4);
    }

    /**
     * 写入一条充值/消费流水记录。
     */
    private void writeLedgerEntry(String apiKeyId, String entryType, BigDecimal amount, BigDecimal balanceAfter,
                                   String note, LocalDate occurredOn) {
        ApiKeyLedgerEntry entry = new ApiKeyLedgerEntry();
        entry.setApiKeyId(apiKeyId);
        entry.setEntryType(entryType);
        entry.setAmount(amount);
        entry.setBalanceAfter(balanceAfter);
        entry.setNote(note);
        entry.setOccurredOn(occurredOn);
        ledgerMapper.insert(entry);
    }

    private ApiKey getOrThrow(String id) {
        ApiKey entity = apiKeyMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("API Key 不存在: " + id);
        return entity;
    }
}
