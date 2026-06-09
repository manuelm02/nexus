package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.Todo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface TodoMapper extends BaseMapper<Todo> {

    @Select("""
            SELECT * FROM todos
            WHERE status <> 'done'
              AND (
                (scheduled_date IS NOT NULL AND scheduled_date < #{today})
                OR (due_date IS NOT NULL AND due_date < #{today})
              )
            ORDER BY COALESCE(due_date, scheduled_date) ASC, created_at DESC
            """)
    List<Todo> selectOverdue(@Param("today") LocalDate today);
}
