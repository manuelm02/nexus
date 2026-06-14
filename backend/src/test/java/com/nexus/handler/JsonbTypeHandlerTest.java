package com.nexus.handler;

import com.baomidou.mybatisplus.annotation.TableField;
import com.nexus.entity.Bookmark;
import org.junit.jupiter.api.Test;

import java.sql.PreparedStatement;
import java.sql.Types;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;

class JsonbTypeHandlerTest {

    @Test
    void setNonNullParameterShouldSendJsonAsJdbcOther() throws Exception {
        PreparedStatement statement = mock(PreparedStatement.class);
        JsonbTypeHandler handler = new JsonbTypeHandler(List.class);

        handler.setNonNullParameter(statement, 1, List.of("建筑", "结构"), null);

        verify(statement).setObject(1, "[\"建筑\",\"结构\"]", Types.OTHER);
    }

    @Test
    void bookmarkTagsShouldUseJsonbTypeHandler() throws Exception {
        TableField tableField = Bookmark.class.getDeclaredField("tags").getAnnotation(TableField.class);

        assertThat(tableField.typeHandler()).isEqualTo(JsonbTypeHandler.class);
    }
}
