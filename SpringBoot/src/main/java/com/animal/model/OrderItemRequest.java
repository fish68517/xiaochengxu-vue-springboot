package com.animal.model;

import lombok.Data;

@Data
public class OrderItemRequest {
    private Integer recipeId;
    private Integer quantity;
} 