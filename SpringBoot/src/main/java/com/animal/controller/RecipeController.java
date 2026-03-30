package com.animal.controller;

import com.animal.mapper.RecipeMapper;
import com.animal.mapper.UserMapper;
import com.animal.model.Recipe;
import com.animal.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {
    @Autowired
    private RecipeMapper recipeMapper;

    @Autowired
    private UserMapper userMapper;

    @GetMapping("/{id}")
    public Recipe getRecipeById(@PathVariable Integer id) {
        return recipeMapper.findById(id);
    }

    @GetMapping("/category/{categoryId}")
    public List<Recipe> getRecipesByCategoryId(@PathVariable Integer categoryId) {
        return recipeMapper.findByCategoryId(categoryId);
    }

    @PostMapping
    public ResponseEntity<?> createRecipe(@RequestParam("userId") Integer userId, @RequestBody Recipe recipe) {
        User operator = userMapper.findById(userId);
        if (operator == null) {
            return ResponseEntity.badRequest().body("用户不存在");
        }
        if ("merchant".equals(operator.getRole())) {
            recipe.setMerchantId(userId);
        }
        if (recipe.getWindowId() == null) {
            recipe.setWindowId(recipe.getCategoryId());
        }
        recipeMapper.insert(recipe);
        return ResponseEntity.ok(recipe);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateRecipe(
            @RequestParam("userId") Integer userId,
            @PathVariable Integer id,
            @RequestBody Recipe recipe) {
        User operator = userMapper.findById(userId);
        if (operator == null) {
            return ResponseEntity.badRequest().body("用户不存在");
        }
        if ("merchant".equals(operator.getRole())) {
            Recipe ownRecipe = recipeMapper.findByIdAndMerchant(id, userId);
            if (ownRecipe == null) {
                return ResponseEntity.status(403).body("无权修改该菜品");
            }
            recipe.setMerchantId(userId);
        }
        if (recipe.getWindowId() == null) {
            recipe.setWindowId(recipe.getCategoryId());
        }
        recipe.setId(id);
        recipeMapper.update(recipe);
        return ResponseEntity.ok(recipe);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRecipe(@RequestParam("userId") Integer userId, @PathVariable Integer id) {
        User operator = userMapper.findById(userId);
        if (operator == null) {
            return ResponseEntity.badRequest().body("用户不存在");
        }
        if ("merchant".equals(operator.getRole())) {
            int rows = recipeMapper.deleteByMerchant(id, userId);
            if (rows == 0) {
                return ResponseEntity.status(403).body("无权删除该菜品");
            }
            return ResponseEntity.ok().build();
        }
        recipeMapper.delete(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/search")
    public List<Recipe> searchRecipes(@RequestParam String keyword) {
        return recipeMapper.searchRecipes(keyword);
    }

    @GetMapping
    public ResponseEntity<?> getRecipes(
            @RequestParam(required = false) Integer userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String query) {
        int offset = (page - 1) * pageSize;
        Integer merchantId = null;
        if (userId != null) {
            User operator = userMapper.findById(userId);
            if (operator != null && "merchant".equals(operator.getRole())) {
                merchantId = userId;
            }
        }

        int total = recipeMapper.count(query, merchantId);
        List<Recipe> recipes = recipeMapper.findByPage(offset, pageSize, query, merchantId);

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("data", recipes);
        return ResponseEntity.ok(result);
    }
}
