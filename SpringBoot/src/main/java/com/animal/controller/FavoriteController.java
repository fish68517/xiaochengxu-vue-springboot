package com.animal.controller;

import com.animal.mapper.FavoriteMapper;
import com.animal.model.Favorite;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {
    @Autowired
    private FavoriteMapper favoriteMapper;

    // 获取用户收藏列表
    @GetMapping("/user")
    public List<Favorite> getUserFavorites(@RequestParam Integer userId) {
        return favoriteMapper.findByUserId(userId);
    }

    // 添加收藏
    @PostMapping("/{recipeId}")
    public ResponseEntity<?> addFavorite(
            @RequestParam Integer userId,
            @PathVariable Integer recipeId) {
        // 检查是否已收藏
        if (favoriteMapper.findByUserIdAndRecipeId(userId, recipeId) != null) {
            return ResponseEntity.badRequest().body("已经收藏过了");
        }

        Favorite favorite = new Favorite();
        favorite.setUserId(userId);
        favorite.setRecipeId(recipeId);
        favoriteMapper.insert(favorite);
        return ResponseEntity.ok(favorite);
    }

    // 取消收藏
    @DeleteMapping("/{recipeId}")
    public ResponseEntity<?> removeFavorite(
            @RequestParam Integer userId,
            @PathVariable Integer recipeId) {
        favoriteMapper.deleteByUserIdAndRecipeId(userId, recipeId);
        return ResponseEntity.ok().build();
    }

    // 检查是否已收藏
    @GetMapping("/check/{recipeId}")
    public boolean checkFavorite(
            @RequestParam Integer userId,
            @PathVariable Integer recipeId) {
        return favoriteMapper.findByUserIdAndRecipeId(userId, recipeId) != null;
    }
} 