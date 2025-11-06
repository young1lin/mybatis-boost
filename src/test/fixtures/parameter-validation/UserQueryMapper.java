package com.example.mapper;

import com.example.model.UserQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface UserQueryMapper {
    /**
     * Find users by complex query object without @Param
     * Should reference fields directly: #{name}, #{ids}
     */
    List<User> findByQuery(UserQuery query);

    /**
     * Find users by complex query object with @Param
     * Should reference fields with prefix: #{query.name}, #{query.ids}
     */
    List<User> findByQueryWithParam(@Param("query") UserQuery query);

    /**
     * Find users with multiple parameters including complex object
     */
    List<User> findByQueryAndStatus(@Param("query") UserQuery query, @Param("status") String status);
}
