package com.example.mapper;

import com.example.query.WelfareActivityQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface WelfareActivityMapper {
    /**
     * MyBatis 3.x+ single object parameter auto-mapping
     * No @Param annotation, no parameterType in XML
     * MyBatis will automatically map query.order and query.size
     */
    List<WelfareActivity> selectByCondition(WelfareActivityQuery condition);

    /**
     * Multiple parameters - one with @Param, one without
     */
    Integer selectTargetTime(@Param("userId") String userId, @Param("newCode") String newCode);

    /**
     * Single String parameter - should NOT auto-map fields
     */
    List<WelfareActivity> selectByStatus(String status);

    /**
     * Single Integer parameter - should NOT auto-map fields
     */
    WelfareActivity selectById(Long id);
}
