package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.Subscription;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface SubscriptionMapper extends BaseMapper<Subscription> {

    @Select("SELECT * FROM subscriptions WHERE status = 'active' AND expire_date IS NOT NULL AND expire_date <= #{threshold}")
    List<Subscription> selectExpiringSoon(LocalDate threshold);
}
