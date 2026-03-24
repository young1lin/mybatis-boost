package com.young1lin.mybatis.boost.multi.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.young1lin.mybatis.boost.multi.domain.CommonEntity;

/**
 * CommonMapper in ORDER module.
 * Same namespace as payment-module's CommonMapper.
 * This is the key test case for multi-module same-namespace navigation.
 *
 * Expected: clicking jumpToXml from THIS file should navigate to
 * order-module/src/main/resources/mapper/CommonMapper.xml (order_common_config table),
 * NOT payment-module's CommonMapper.xml (payment_common_config table).
 */
@Mapper
public interface CommonMapper {

    CommonEntity selectById(@Param("id") Long id);

    List<CommonEntity> selectByType(@Param("type") String type);

    List<CommonEntity> selectAll();

    int insert(CommonEntity entity);

    int updateById(CommonEntity entity);

    int deleteById(@Param("id") Long id);

}
