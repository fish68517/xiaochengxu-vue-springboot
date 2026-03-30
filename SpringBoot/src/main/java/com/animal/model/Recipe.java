package com.animal.model;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Date;

@Data
public class Recipe {
    private Integer id;
    private Integer categoryId;
    private Integer merchantId;
    private Integer windowId;
    private String name;
    private String description;
    private String ingredients;
    private String steps;
    private String image;
    private Integer cookingTime;
    private String difficulty;
    private BigDecimal price;
    private Date createdAt;

    private String taste;
    private String cookingMethod;
    private String cuisineType;
    private String foodCategory;
}
