package com.young1lin.mybatis.boost.integration.test.inheritance.audit;

import com.young1lin.mybatis.boost.integration.test.inheritance.base.NavigationBaseEntity;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * Second level of the manual navigation fixture.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class NavigationAuditEntity extends NavigationBaseEntity<Long> {

    private String updatedBy;

    /**
     * Shadows NavigationBaseEntity.fieldA. MyBatis property navigation for
     * "fieldA" must stop here because this is the nearest declaration.
     */
    private String fieldA;
}
