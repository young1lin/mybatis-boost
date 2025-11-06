package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import java.util.List;

/**
 * Test case: method parameters using fully qualified class names WITHOUT imports
 */
@Mapper
public interface FullyQualifiedParamMapper {
    // Single parameter with fully qualified class name
    List<User> queryUsers(com.example.query.UserQuery query);

    // Multiple parameters with mixed FQN and simple names
    int updateUser(Long id, com.example.entity.UserUpdateRequest request);
}
