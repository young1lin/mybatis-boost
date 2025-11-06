package com.young1lin.mybatis.boost.integration.test.domain;

import java.io.Serializable;
import java.sql.Timestamp;

import lombok.Data;


@Data
public class User implements Serializable {

    private Long id;

    private String name;

    private Integer age;

    private Timestamp createTime;

    private Timestamp updateTime;

    private Integer version;

}
