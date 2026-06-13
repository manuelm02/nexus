package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.Bookmark;
import org.apache.ibatis.annotations.Mapper;

/** 书签 MyBatis-Plus Mapper，继承 BaseMapper 获得免费 CRUD。 */
@Mapper
public interface BookmarkMapper extends BaseMapper<Bookmark> {
}
