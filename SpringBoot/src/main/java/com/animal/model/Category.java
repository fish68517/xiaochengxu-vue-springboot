package com.animal.model;

import lombok.Data;

@Data
public class Category {
    private Integer id;
    private String name;
    private String description;
    private Integer sortOrder;
} 