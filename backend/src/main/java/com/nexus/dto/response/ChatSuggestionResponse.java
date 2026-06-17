package com.nexus.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Chat 首页动态推荐词条响应。 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatSuggestionResponse {
    private String text;
}
