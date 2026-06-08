package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.Focus;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;

@Mapper
public interface FocusMapper extends BaseMapper<Focus> {

    @Update("UPDATE focus SET scheduled_date = #{today}, updated_at = NOW() " +
            "WHERE status IN ('not_started', 'in_progress') AND scheduled_date < #{today}")
    int rolloverUnfinished(LocalDate today);
}
