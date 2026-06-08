package com.nexus.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.User;
import com.nexus.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Profile("local")
@RequiredArgsConstructor
public class DevDataInitializer implements CommandLineRunner {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        boolean exists = userMapper.exists(
                new LambdaQueryWrapper<User>().eq(User::getUsername, "admin"));
        if (!exists) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setNickname("Admin");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setRole("admin");
            admin.setStatus("active");
            userMapper.insert(admin);
            log.info(">>> 开发用户已创建：admin / admin123");
        }
    }
}
