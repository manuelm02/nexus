package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.Task;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TaskMapper extends BaseMapper<Task> {

    @Update("UPDATE tasks SET archived = true, updated_at = NOW() " +
            "WHERE keep_forever = false AND archived = false " +
            "AND expires_at IS NOT NULL AND expires_at < NOW()")
    int archiveExpired();
}
