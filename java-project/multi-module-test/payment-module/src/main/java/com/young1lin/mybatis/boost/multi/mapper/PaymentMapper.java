package com.young1lin.mybatis.boost.multi.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.young1lin.mybatis.boost.multi.domain.Payment;

@Mapper
public interface PaymentMapper {

    Payment selectById(@Param("id") Long id);

    List<Payment> selectByOrderId(@Param("orderId") Long orderId);

    List<Payment> selectByChannel(@Param("channel") String channel);

    int insert(Payment payment);

    int updateById(Payment payment);

    int deleteById(@Param("id") Long id);

}
