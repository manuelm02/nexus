package com.nexus.service;

import com.nexus.dto.request.ApiKeyConsumeRequest;
import com.nexus.dto.request.ApiKeyRechargeRequest;
import com.nexus.dto.response.ApiKeyResponse;
import com.nexus.entity.ApiKey;
import com.nexus.entity.ApiKeyLedgerEntry;
import com.nexus.mapper.ApiKeyBalanceSnapshotMapper;
import com.nexus.mapper.ApiKeyLedgerEntryMapper;
import com.nexus.mapper.ApiKeyMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** ApiKeyService 单元测试：验证充值和消费在 apiFetchEnabled 开启/关闭模式下的余额和行为差异 */
@ExtendWith(MockitoExtension.class)
class ApiKeyServiceTest {

    @Mock
    private ApiKeyMapper apiKeyMapper;
    @Mock
    private ApiKeyLedgerEntryMapper ledgerMapper;
    @Mock
    private ApiKeyBalanceSnapshotMapper balanceSnapshotMapper;
    @Mock
    private LlmConfigService llmConfigService;

    @InjectMocks
    private ApiKeyService apiKeyService;

    /**
     * apiFetchEnabled=false 时消费：应扣减 remainingBalance，增加 monthlySpend，写入 consume 流水。
     * 这对应普通 Provider（如 OpenAI 兼容接口）需要手动管理余额的场景。
     */
    @Test
    void consumeShouldDeductBalanceWhenApiFetchDisabled() {
        ApiKey entity = buildApiKey("k1", "OpenAI", false);
        entity.setRemainingBalance(new BigDecimal("100.00"));
        entity.setMonthlySpend(new BigDecimal("10.00"));
        when(apiKeyMapper.selectById("k1")).thenReturn(entity);

        ApiKeyConsumeRequest req = new ApiKeyConsumeRequest();
        req.setAmount(new BigDecimal("20.00"));

        ApiKeyResponse result = apiKeyService.consume("k1", req);

        // 余额应从 100 扣减到 80
        assertThat(result.getRemainingBalance()).isEqualByComparingTo("80.00");
        // 月消费从 10 累加到 30
        assertThat(result.getMonthlySpend()).isEqualByComparingTo("30.00");
        // 断言 entity 被更新（含余额和月消费字段）
        verify(apiKeyMapper).updateById(entity);
        assertThat(entity.getRemainingBalance()).isEqualByComparingTo("80.00");
        assertThat(entity.getMonthlySpend()).isEqualByComparingTo("30.00");

        // 断言写入 consume 流水，balanceAfter 应等于扣减后的余额
        ArgumentCaptor<ApiKeyLedgerEntry> ledgerCaptor = ArgumentCaptor.forClass(ApiKeyLedgerEntry.class);
        verify(ledgerMapper).insert(ledgerCaptor.capture());
        ApiKeyLedgerEntry ledger = ledgerCaptor.getValue();
        assertThat(ledger.getEntryType()).isEqualTo("consume");
        assertThat(ledger.getAmount()).isEqualByComparingTo("20.00");
        assertThat(ledger.getBalanceAfter()).isEqualByComparingTo("80.00");
    }

    /**
     * apiFetchEnabled=true 时消费：不扣减 remainingBalance（由官方同步作为真值），
     * 但月消费应累加，写入 consume 流水，流水中的 balanceAfter 仅为快照。
     * 这是 DeepSeek 等自动余额同步 Provider 的核心逻辑——手动消费不应改写官方余额。
     */
    @Test
    void consumeShouldNotDeductBalanceWhenApiFetchEnabled() {
        ApiKey entity = buildApiKey("k2", "DeepSeek", true);
        entity.setRemainingBalance(new BigDecimal("100.00"));
        entity.setMonthlySpend(new BigDecimal("10.00"));
        when(apiKeyMapper.selectById("k2")).thenReturn(entity);

        ApiKeyConsumeRequest req = new ApiKeyConsumeRequest();
        req.setAmount(new BigDecimal("20.00"));

        ApiKeyResponse result = apiKeyService.consume("k2", req);

        // 官方余额不变，仍为 100
        assertThat(result.getRemainingBalance()).isEqualByComparingTo("100.00");
        // 月消费从 10 累加到 30
        assertThat(result.getMonthlySpend()).isEqualByComparingTo("30.00");
        // 断言 entity 被更新（仅月消费字段改变，余额不变）
        verify(apiKeyMapper).updateById(entity);
        assertThat(entity.getRemainingBalance()).isEqualByComparingTo("100.00");
        assertThat(entity.getMonthlySpend()).isEqualByComparingTo("30.00");

        // 断言写入 consume 流水
        ArgumentCaptor<ApiKeyLedgerEntry> ledgerCaptor = ArgumentCaptor.forClass(ApiKeyLedgerEntry.class);
        verify(ledgerMapper).insert(ledgerCaptor.capture());
        ApiKeyLedgerEntry ledger = ledgerCaptor.getValue();
        assertThat(ledger.getEntryType()).isEqualTo("consume");
        assertThat(ledger.getAmount()).isEqualByComparingTo("20.00");
    }

    /**
     * apiFetchEnabled=false 时充值：应增加 remainingBalance，写入 recharge 流水。
     */
    @Test
    void rechargeShouldAddBalanceWhenApiFetchDisabled() {
        ApiKey entity = buildApiKey("k1", "OpenAI", false);
        entity.setRemainingBalance(new BigDecimal("50.00"));
        when(apiKeyMapper.selectById("k1")).thenReturn(entity);

        ApiKeyRechargeRequest req = new ApiKeyRechargeRequest();
        req.setAmount(new BigDecimal("30.00"));

        ApiKeyResponse result = apiKeyService.recharge("k1", req);

        assertThat(result.getRemainingBalance()).isEqualByComparingTo("80.00");
        verify(apiKeyMapper).updateById(entity);
        assertThat(entity.getRemainingBalance()).isEqualByComparingTo("80.00");

        ArgumentCaptor<ApiKeyLedgerEntry> ledgerCaptor = ArgumentCaptor.forClass(ApiKeyLedgerEntry.class);
        verify(ledgerMapper).insert(ledgerCaptor.capture());
        assertThat(ledgerCaptor.getValue().getEntryType()).isEqualTo("recharge");
    }

    /**
     * apiFetchEnabled=true 时充值：不修改 remainingBalance（以官方同步为真值），仅写流水。
     */
    @Test
    void rechargeShouldNotAddBalanceWhenApiFetchEnabled() {
        ApiKey entity = buildApiKey("k2", "DeepSeek", true);
        entity.setRemainingBalance(new BigDecimal("100.00"));
        when(apiKeyMapper.selectById("k2")).thenReturn(entity);

        ApiKeyRechargeRequest req = new ApiKeyRechargeRequest();
        req.setAmount(new BigDecimal("30.00"));

        ApiKeyResponse result = apiKeyService.recharge("k2", req);

        // 官方余额不变
        assertThat(result.getRemainingBalance()).isEqualByComparingTo("100.00");
        // 不调用 updateById（因为不修改余额）
        verify(apiKeyMapper).selectById("k2");
        // 流水仍然写入
        ArgumentCaptor<ApiKeyLedgerEntry> ledgerCaptor = ArgumentCaptor.forClass(ApiKeyLedgerEntry.class);
        verify(ledgerMapper).insert(ledgerCaptor.capture());
        assertThat(ledgerCaptor.getValue().getEntryType()).isEqualTo("recharge");
    }

    private ApiKey buildApiKey(String id, String provider, boolean apiFetchEnabled) {
        ApiKey entity = new ApiKey();
        entity.setId(id);
        entity.setLabel("Test Key: " + provider);
        entity.setProvider(provider.toLowerCase());
        entity.setEncryptedKey("encrypted-mock-key");
        entity.setStatus("active");
        entity.setMonthlySpend(BigDecimal.ZERO);
        entity.setApiFetchEnabled(apiFetchEnabled);
        entity.setArchived(false);
        return entity;
    }
}
