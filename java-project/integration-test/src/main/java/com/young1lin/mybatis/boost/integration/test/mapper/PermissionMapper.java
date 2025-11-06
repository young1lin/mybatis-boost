package com.young1lin.mybatis.boost.integration.test.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.young1lin.mybatis.boost.integration.test.domain.Permission;

import jakarta.annotation.Nonnull;

public interface PermissionMapper {

    Permission selectById(@Nonnull @Param("id") Long id);

    List<Permission> listAll();

}
