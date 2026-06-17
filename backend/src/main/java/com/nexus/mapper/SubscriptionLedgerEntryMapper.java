package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.SubscriptionLedgerEntry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SubscriptionLedgerEntryMapper extends BaseMapper<SubscriptionLedgerEntry> {

    @Select("SELECT * FROM subscription_ledger_entries WHERE subscription_id = #{subscriptionId} ORDER BY created_at DESC, id DESC LIMIT #{limit}")
    List<SubscriptionLedgerEntry> selectRecent(@Param("subscriptionId") String subscriptionId, @Param("limit") int limit);
}
