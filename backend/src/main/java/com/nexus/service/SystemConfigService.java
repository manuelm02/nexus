package com.nexus.service;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.SystemConfig;
import com.nexus.mapper.SystemConfigMapper;

import lombok.RequiredArgsConstructor;

/** SystemConfigService 管理系统级动态配置，支持预置项和运行时新增项。 */
@Service
@RequiredArgsConstructor
public class SystemConfigService {

    private final SystemConfigMapper systemConfigMapper;

    public String get(String key) {
        SystemConfig config = systemConfigMapper.selectOne(
                new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, key));
        return config != null ? config.getConfigVal() : null;
    }

    public String get(String key, String defaultValue) {
        String val = get(key);
        return val != null ? val : defaultValue;
    }

    public Map<String, String> getAll() {
        return systemConfigMapper.selectList(null).stream()
                .filter(config -> !config.getConfigKey().startsWith("translate.api."))
                .collect(Collectors.toMap(SystemConfig::getConfigKey, SystemConfig::getConfigVal));
    }

    public void updateAll(Map<String, String> updates) {
        updates.forEach((key, val) -> {
            upsert(key, val, null);
        });
    }

    /**
     * 新增或更新系统配置，Settings V2 的动态配置项不能依赖 Flyway 预置每个 key。
     *
     * @param key 配置键
     * @param val 配置值
     * @param description 配置说明，可为空
     */
    public void upsert(String key, String val, String description) {
        SystemConfig config = systemConfigMapper.selectOne(
                new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, key));
        if (config != null) {
            config.setConfigVal(val);
            if (description != null) config.setDescription(description);
            systemConfigMapper.updateById(config);
            return;
        }
        config = new SystemConfig();
        config.setConfigKey(key);
        config.setConfigVal(val);
        config.setDescription(description);
        systemConfigMapper.insert(config);
    }
}
