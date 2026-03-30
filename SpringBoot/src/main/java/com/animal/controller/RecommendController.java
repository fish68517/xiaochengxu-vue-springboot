package com.animal.controller;

import com.animal.mapper.RecipeMapper;
import com.animal.model.Recipe;
import com.animal.service.RecommendService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;



import java.util.List;

@RestController
@RequestMapping("/api/recommend")
public class RecommendController {

    @Autowired
    private RecommendService recommendService;

    @Autowired
    private RecipeMapper recipeMapper;

    @GetMapping
    public List<Recipe> getRecommendedRecipes(@RequestParam Integer userId) {
        return recommendService.recommendRecipes(userId);
    }

    @GetMapping("/hot")
    public List<Recipe> getHotRecipes() {
        return recipeMapper.findHotRecipes(4);
    }
}
