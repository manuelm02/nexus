package com.nexus.dto.response;

import com.nexus.entity.Todo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** ToDo 看板响应，后端保证 today/future/overdue/tasks 四个分组互斥 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TodoBoardResponse {
    private List<Todo> today;
    private List<Todo> future;
    private List<Todo> overdue;
    private List<Todo> tasks;
}
