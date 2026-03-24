package com.young1lin.mybatis.boost.multi.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.young1lin.mybatis.boost.multi.domain.Order;

@Mapper
public interface OrderMapper {

    Order selectById(@Param("id") Long id);

    List<Order> selectByUserId(@Param("userId") Long userId);

    List<Order> selectByStatus(@Param("status") Integer status);

    int insert(Order order);

    int updateById(Order order);

    int deleteById(@Param("id") Long id);

}
