package com.nexus.service;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.SystemConfig;
import com.nexus.mapper.SystemConfigMapper;

import lombok.RequiredArgsConstructor;

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
                .collect(Collectors.toMap(SystemConfig::getConfigKey, SystemConfig::getConfigVal));
    }

    public void updateAll(Map<String, String> updates) {
        updates.forEach((key, val) -> {
            SystemConfig config = systemConfigMapper.selectOne(
                    new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, key));
            if (config != null) {
                config.setConfigVal(val);
                systemConfigMapper.updateById(config);
            }
        });
    }
}
