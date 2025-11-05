package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

/**
 * Role mapper interface for testing parameter validation
 */
@Mapper
public interface RoleMapper {

    /**
     * Select role by ID
     */
    Role selectById(Long id);

    /**
     * Select roles by name pattern
     */
    List<Role> selectByName(@Param("roleName") String name);

    /**
     * Insert a new role
     */
    int insert(Role role);

    /**
     * Update role by ID
     */
    int updateById(Role role);

    /**
     * Delete role by ID and version (optimistic locking)
     */
    int deleteByIdAndVersion(@Param("id") Long id, @Param("version") Integer version);

    /**
     * Select roles by multiple criteria
     */
    List<Role> selectByCriteria(@Param("roleName") String roleName, @Param("remark") String remark);
}
