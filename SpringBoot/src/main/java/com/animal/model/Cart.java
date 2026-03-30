package com.animal.model;

import lombok.Data;
import java.util.Date;

@Data
public class Cart {
    private Integer id;
    private Integer userId;
    private Integer recipeId;
    private Integer quantity;
    private Date createdAt;
    
    // 额外的属性用于前端展示
    private Recipe recipe;
} 