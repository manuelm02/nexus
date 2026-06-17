package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.SubscriptionBalanceSnapshot;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SubscriptionBalanceSnapshotMapper extends BaseMapper<SubscriptionBalanceSnapshot> {

    @Select("SELECT * FROM subscription_balance_snapshots WHERE subscription_id = #{subscriptionId} " +
            "AND snapshotted_at >= now() - (#{days} || ' days')::interval ORDER BY snapshotted_at ASC")
    List<SubscriptionBalanceSnapshot> selectRecent(@Param("subscriptionId") String subscriptionId, @Param("days") int days);
}
