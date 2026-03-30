package com.animal.model;

import lombok.Data;
import java.util.Date;

@Data
public class Review {
    private Integer id;
    private Integer userId;
    private Integer recipeId;
    private Integer rating;
    private String content;
    private Date createdAt;
    
    // 额外的属性用于前端展示
    private User user;
    private Recipe recipe;


} 