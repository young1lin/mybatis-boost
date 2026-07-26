package com.young1lin.mybatis.boost.integration.test.inheritance.query;

import com.young1lin.mybatis.boost.integration.test.inheritance.audit.NavigationAuditEntity;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * Third level of the manual navigation fixture:
 * NavigationTaskQuery -> NavigationAuditEntity -> NavigationBaseEntity.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class NavigationTaskQuery extends NavigationAuditEntity {

    private String taskName;

    private Integer status;
}
