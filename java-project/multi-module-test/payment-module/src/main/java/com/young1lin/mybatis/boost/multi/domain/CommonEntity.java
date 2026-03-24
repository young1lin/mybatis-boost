package com.young1lin.mybatis.boost.multi.domain;

import java.io.Serializable;
import java.sql.Timestamp;

import lombok.Data;

/**
 * Common entity used by CommonMapper in payment-module.
 * Fields: id, name, type, status, createTime
 */
@Data
public class CommonEntity implements Serializable {

    private Long id;

    private String name;

    private String type;

    private Integer status;

    private Timestamp createTime;

}
