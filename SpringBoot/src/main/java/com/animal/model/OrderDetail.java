package com.animal.model;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class OrderDetail {
    private Integer id;
    private Integer orderId;
    private Integer recipeId;
    private Integer quantity;
    private BigDecimal price;
    
    // 额外的属性用于前端展示
    private Recipe recipe;
} 