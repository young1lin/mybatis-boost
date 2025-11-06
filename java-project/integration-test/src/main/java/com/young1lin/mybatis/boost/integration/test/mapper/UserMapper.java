package com.young1lin.mybatis.boost.integration.test.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.young1lin.mybatis.boost.integration.test.domain.User;

import jakarta.annotation.Nonnull;

@Mapper
public interface UserMapper {

    /**
     * should not go to xml file
     */
    @Select("SELECT * FROM `user` WHERE id = #{id}")
    User selectById(@Param("id") Long id);

    List<User> listAllByIds(@Param("ids") List<Long> ids);

    /**
     * wrap line also should be recognized
     */
    User selectByIdAndName(
            @Param("id") Long id,
            @Param("name") String name);

    int updateById(@Nonnull User user);

    int batchInsert(List<User> users);

    int batchInsertV2(@Param("users") List<User> users);

    int batchInsertV3(@Param("aUsers") List<User> users);

}
