package com.animal.model;

import lombok.Data;

import java.util.List;

@Data
public class OrderRequest {
    private List<OrderItemRequest> items;
    private List<Integer> cartItemIds;
    private String remark;
}

