package com.example.mapper;

import com.example.query.TaskQuery;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface TaskMapper {
    /**
     * Single object parameter auto-mapping with inherited fields
     * TaskQuery extends AuditEntity extends BaseEntity<Long>
     */
    List<TaskQuery> selectByCondition(TaskQuery condition);

    /**
     * parameterType with inherited fields
     */
    int countByCondition(TaskQuery condition);
}
