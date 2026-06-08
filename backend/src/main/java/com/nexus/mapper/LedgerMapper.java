package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.Ledger;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface LedgerMapper extends BaseMapper<Ledger> {

    @Select("SELECT * FROM ledger WHERE status = 'active' AND expire_date IS NOT NULL AND expire_date <= #{threshold}")
    List<Ledger> selectExpiringSoon(LocalDate threshold);
}
