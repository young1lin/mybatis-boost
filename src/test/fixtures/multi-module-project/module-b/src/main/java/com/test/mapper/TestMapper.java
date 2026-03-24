package com.test.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

/**
 * TestMapper in module-b
 */
@Mapper
public interface TestMapper {

    List<Object> selectAll();

    Object selectById(@Param("id") Long id);

    int insert(Object entity);

    int updateById(Object entity);

    int deleteById(@Param("id") Long id);
}
