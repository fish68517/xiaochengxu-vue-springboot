package com.animal.model;

import lombok.Data;
import java.util.Date;

@Data
public class Favorite {
    private Integer id;
    private Integer userId;
    private Integer recipeId;
    private Date createdAt;
    
    // 关联的菜品信息
    private Recipe recipe;
} 