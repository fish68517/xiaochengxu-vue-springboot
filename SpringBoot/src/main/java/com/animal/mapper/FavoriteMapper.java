package com.animal.mapper;

import com.animal.model.Favorite;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface FavoriteMapper {
    @Select("SELECT f.*, r.name as 'recipe.name', r.description as 'recipe.description', " +
            "r.image as 'recipe.image', r.difficulty as 'recipe.difficulty' " +
            "FROM favorite f " +
            "LEFT JOIN recipe r ON f.recipe_id = r.id " +
            "WHERE f.user_id = #{userId}")
    List<Favorite> findByUserId(Integer userId);

    @Select("SELECT * FROM favorite WHERE user_id = #{userId} AND recipe_id = #{recipeId}")
    Favorite findByUserIdAndRecipeId(@Param("userId") Integer userId, @Param("recipeId") Integer recipeId);

    @Insert("INSERT INTO favorite(user_id, recipe_id, created_at) VALUES(#{userId}, #{recipeId}, NOW())")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Favorite favorite);

    @Delete("DELETE FROM favorite WHERE id = #{id}")
    int delete(Integer id);

    @Delete("DELETE FROM favorite WHERE user_id = #{userId} AND recipe_id = #{recipeId}")
    int deleteByUserIdAndRecipeId(@Param("userId") Integer userId, @Param("recipeId") Integer recipeId);
} 