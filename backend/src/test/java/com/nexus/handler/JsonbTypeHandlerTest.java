package com.nexus.handler;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.nexus.entity.Bookmark;
import com.nexus.entity.MindBankAgentStep;
import com.nexus.entity.MindBankAgentSuggestion;
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

    @Test
    void agentStepJsonbFieldsUseJsonbTypeHandler() throws Exception {
        assertThat(MindBankAgentStep.class.getAnnotation(TableName.class).autoResultMap()).isTrue();
        assertThat(MindBankAgentStep.class.getDeclaredField("toolInput").getAnnotation(TableField.class).typeHandler())
                .isEqualTo(JsonbTypeHandler.class);
        assertThat(MindBankAgentStep.class.getDeclaredField("toolOutput").getAnnotation(TableField.class).typeHandler())
                .isEqualTo(JsonbTypeHandler.class);
    }

    @Test
    void agentSuggestionJsonbFieldsUseJsonbTypeHandler() throws Exception {
        assertThat(MindBankAgentSuggestion.class.getAnnotation(TableName.class).autoResultMap()).isTrue();
        assertThat(MindBankAgentSuggestion.class.getDeclaredField("affectedNotes").getAnnotation(TableField.class).typeHandler())
                .isEqualTo(JsonbTypeHandler.class);
        assertThat(MindBankAgentSuggestion.class.getDeclaredField("proposedAction").getAnnotation(TableField.class).typeHandler())
                .isEqualTo(JsonbTypeHandler.class);
    }
}
