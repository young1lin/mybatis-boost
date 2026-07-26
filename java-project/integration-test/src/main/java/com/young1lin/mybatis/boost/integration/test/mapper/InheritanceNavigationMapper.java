package com.young1lin.mybatis.boost.integration.test.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import com.young1lin.mybatis.boost.integration.test.inheritance.query.NavigationTaskQuery;

/**
 * Manual fixture for XML-to-Java field navigation through multiple superclasses.
 */
@Mapper
public interface InheritanceNavigationMapper {

    List<NavigationTaskQuery> selectByCondition(NavigationTaskQuery condition);

    int countByCondition(NavigationTaskQuery condition);
}
