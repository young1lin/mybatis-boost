package com.young1lin.mybatis.boost.multi.domain;

import java.io.Serializable;
import java.math.BigDecimal;
import java.sql.Timestamp;

import lombok.Data;

@Data
public class Order implements Serializable {

    private Long id;

    private String orderNo;

    private Long userId;

    private BigDecimal totalAmount;

    private Integer status;

    private Timestamp createTime;

    private Timestamp updateTime;

    private Integer version;

}
