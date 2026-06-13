package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nexus.dto.request.TranslateRequest;
import com.nexus.dto.response.HistoryPageResponse;
import com.nexus.entity.Translation;
import com.nexus.mapper.TranslationMapper;
import com.nexus.translate.TranslationProviderPort;
import com.nexus.translate.TranslationResultPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/** 调用统一 LLM 配置完成翻译并管理翻译历史的分页查询、删除、老化清理。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranslateService {

    private final TranslationMapper translationMapper;
    private final TranslationProviderPort translationProvider;

    /**
     * 生成翻译并持久化分层结果，供当前工作区和历史记录复用。
     *
     * @param req 翻译原文、目标语言、风格和可选上下文
     * @return 已持久化的翻译实体
     */
    public Translation translate(TranslateRequest req) {
        TranslationResultPayload payload = translationProvider.translate(req);
        return persist(req, payload);
    }

    /**
     * 持久化指定翻译结果，供普通翻译和流式增强翻译复用同一历史写入规则。
     *
     * @param req 翻译请求上下文
     * @param payload provider 返回的结构化结果
     * @return 已插入数据库的翻译实体
     */
    public Translation persist(TranslateRequest req, TranslationResultPayload payload) {
        Translation t = new Translation();
        t.setSourceText(req.getSourceText());
        t.setTranslatedText(payload.translatedText());
        t.setSourceLang(req.getSourceLang());
        t.setTargetLang(req.getTargetLang());
        t.setStyle(req.getStyle());
        t.setExplanation(payload.explanation());
        t.setKeywords(payload.keywords() == null ? List.of() : payload.keywords());
        t.setAlternatives(payload.alternatives() == null ? List.of() : payload.alternatives());
        t.setProvider(payload.provider());
        translationMapper.insert(t);
        return t;
    }

    /**
     * 后端分页查询翻译历史，默认按创建时间倒序。
     *
     * @param page 页码，从 1 开始
     * @param size 每页条数，默认 12
     * @return 分页结果包装
     */
    public HistoryPageResponse<Translation> history(int page, int size) {
        Page<Translation> pageResult = translationMapper.selectPage(
                new Page<>(page, size),
                new LambdaQueryWrapper<Translation>().orderByDesc(Translation::getCreatedAt));
        return new HistoryPageResponse<>(pageResult.getRecords(), pageResult.getTotal(), page, size);
    }

    /** 删除指定翻译记录，不存在时静默返回。 */
    public void deleteHistory(String id) {
        translationMapper.deleteById(id);
    }

    /**
     * 清理超过指定天数的历史记录。
     *
     * @param days 保留天数，默认 30 天
     * @return 清理条数
     */
    public int cleanupStale(int days) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        List<Translation> stale = translationMapper.selectList(
                new LambdaQueryWrapper<Translation>().lt(Translation::getCreatedAt, cutoff));
        if (stale.isEmpty()) return 0;
        List<String> ids = stale.stream().map(Translation::getId).toList();
        int count = translationMapper.deleteByIds(ids);
        log.info("清理 {} 天前的翻译历史 {} 条", days, count);
        return count;
    }
}
