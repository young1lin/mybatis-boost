package com.young1lin.mybatis.boost.integration.test;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Stream;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.CommandLineRunner;

import com.young1lin.mybatis.boost.integration.test.domain.User;
import com.young1lin.mybatis.boost.integration.test.mapper.PermissionMapper;
import com.young1lin.mybatis.boost.integration.test.mapper.RoleMapper;
import com.young1lin.mybatis.boost.integration.test.mapper.UserMapper;
import com.young1lin.mybatis.boost.integration.test.mapper.UserRoleMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RequiredArgsConstructor
@Slf4j
public class MapperRunner implements CommandLineRunner, ApplicationRunner {

    private final UserMapper userMapper;

    private final RoleMapper roleMapper;

    private final PermissionMapper permissionMapper;

    private final UserRoleMapper userRoleMapper;

    @Override
    public void run(String... args) throws Exception {
        log.info("UserMapper: {}", userMapper.selectById(1L));
        log.info("RoleMapper: {}", roleMapper.getById(1L));
        log.info("PermissionMapper: {}", permissionMapper.selectById(1L));
        log.info("PermissionMapper: {}", permissionMapper.listAll());
        log.info("UserRoleMapper: {}", userRoleMapper.listAllByUserId(1L));
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        userMapper.batchInsert(obtainUsers());
        log.info("batchInsert v1, effect rows: {}", userMapper.batchInsert(obtainUsers()));
        log.info("batchInsert v2, effect rows: {}", userMapper.batchInsertV2(obtainUsers()));
        log.info("batchInsert v3, effect rows: {}", userMapper.batchInsertV3(obtainUsers()));
    }

    private List<User> obtainUsers() {
        return Stream
                .generate(() -> {
                    User user = new User();
                    user.setName(UUID.randomUUID().toString());
                    user.setAge(ThreadLocalRandom.current().nextInt(18, 60));
                    user.setCreateTime(Timestamp.valueOf(LocalDateTime.now()));
                    user.setUpdateTime(Timestamp.valueOf(LocalDateTime.now()));
                    user.setVersion(0);
                    return user;
                })
                .limit(3)
                .toList();
    }
}
