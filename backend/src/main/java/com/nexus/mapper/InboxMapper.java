package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.InboxItem;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface InboxMapper extends BaseMapper<InboxItem> {}
