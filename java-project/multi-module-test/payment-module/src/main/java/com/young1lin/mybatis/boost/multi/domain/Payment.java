package com.young1lin.mybatis.boost.multi.domain;

import java.io.Serializable;
import java.math.BigDecimal;
import java.sql.Timestamp;

import lombok.Data;

@Data
public class Payment implements Serializable {

    private Long id;

    private String paymentNo;

    private Long orderId;

    private BigDecimal amount;

    private String channel;

    private Integer status;

    private Timestamp createTime;

    private Timestamp updateTime;

}
