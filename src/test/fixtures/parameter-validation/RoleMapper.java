package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import javax.annotation.Nonnull;
import java.util.List;

@Mapper
public interface RoleMapper {
    /**
     * Delete role by id and version
     */
    int deleteById(
        @Nonnull @Param("id") Long id,
        @Nonnull @Param("version") Integer version);

    /**
     * Get role by id
     */
    Role getById(@Nonnull @Param("id") Long id);

    /**
     * List all users by ids using foreach
     */
    List<User> listAllByIds(@Param("ids") List<Long> ids);
}
