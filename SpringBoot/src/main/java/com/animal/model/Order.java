package com.animal.model;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Data
public class Order {
    private Integer id;
    private Integer userId;
    private String orderNo;
    private String pickupCode;
    private String remark;
    private BigDecimal totalAmount;
    private String status;
    private Date createdAt;
    
    // 额外的属性用于前端展示
    private List<OrderDetail> orderDetails;
} 
