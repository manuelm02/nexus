package com.nexus.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.nexus.dto.response.SubscriptionCategoryResponse;
import com.nexus.entity.SubscriptionCategory;
import com.nexus.mapper.SubscriptionCategoryMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 订阅分类管理服务单元测试。 */
@ExtendWith(MockitoExtension.class)
class SubscriptionCategoryServiceTest {

    @Mock
    private SubscriptionCategoryMapper categoryMapper;

    @InjectMocks
    private SubscriptionCategoryService categoryService;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), SubscriptionCategory.class);
    }

    /** 创建分类后能在 list 中查到。 */
    @Test
    void create_newCategory() {
        when(categoryMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        categoryService.create("AI 工具");

        SubscriptionCategory cat = new SubscriptionCategory();
        cat.setId("c1");
        cat.setName("AI 工具");
        when(categoryMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(cat));

        List<SubscriptionCategoryResponse> list = categoryService.list();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getName()).isEqualTo("AI 工具");
    }

    /** 同名分类已存在时直接返回已有记录，不重复插入。 */
    @Test
    void create_duplicateName_returnsExisting() {
        SubscriptionCategory existing = new SubscriptionCategory();
        existing.setId("c1");
        existing.setName("AI 工具");

        when(categoryMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(null)
                .thenReturn(existing);
        // 模拟 MyBatis-Plus ASSIGN_UUID 在 insert 时自动填充 ID
        org.mockito.Mockito.doAnswer(invocation -> {
            SubscriptionCategory arg = invocation.getArgument(0);
            arg.setId("new-id");
            return 1;
        }).when(categoryMapper).insert(any(SubscriptionCategory.class));

        SubscriptionCategoryResponse first = categoryService.create("AI 工具");
        SubscriptionCategoryResponse second = categoryService.create("AI 工具");

        assertThat(first.getId()).isEqualTo("new-id");
        assertThat(second.getId()).isEqualTo("c1");
    }

    /** list 按 name 排序返回。 */
    @Test
    void list_sortedByName() {
        SubscriptionCategory cloud = new SubscriptionCategory();
        cloud.setId("c1");
        cloud.setName("云服务");

        SubscriptionCategory ai = new SubscriptionCategory();
        ai.setId("c2");
        ai.setName("AI 工具");

        when(categoryMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(ai, cloud));

        List<SubscriptionCategoryResponse> list = categoryService.list();
        assertThat(list).hasSize(2);
        assertThat(list.get(0).getName()).isEqualTo("AI 工具");
        assertThat(list.get(1).getName()).isEqualTo("云服务");
    }

    /** 删除已有分类。 */
    @Test
    void delete_existing() {
        SubscriptionCategory cat = new SubscriptionCategory();
        cat.setId("c1");
        cat.setName("AI 工具");
        when(categoryMapper.selectById("c1")).thenReturn(cat);

        categoryService.delete("c1");

        verify(categoryMapper).deleteById("c1");
    }

    /** 删除不存在的分类应抛异常。 */
    @Test
    void delete_nonExisting_throws() {
        when(categoryMapper.selectById("non-existing")).thenReturn(null);

        assertThatThrownBy(() -> categoryService.delete("non-existing"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
