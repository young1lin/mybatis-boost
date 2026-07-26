package com.young1lin.mybatis.boost.integration.test.inheritance.base;

import lombok.Data;

/**
 * First level of the manual navigation fixture.
 */
@Data
public class NavigationBaseEntity<ID> {

    private ID id;

    private String createdBy;

    private String baseOnlyField;

    /**
     * Deliberately shadowed by NavigationAuditEntity.
     */
    private String fieldA;

    /**
     * The annotation makes this field unsuitable for the old line-based parser,
     * so navigation to it also exercises the bundled Java AST parser.
     */
    @Deprecated
    private String astOnlyField;
}
