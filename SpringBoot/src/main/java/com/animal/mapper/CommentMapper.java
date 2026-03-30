package com.animal.mapper;

import com.animal.model.Comment;
import org.apache.ibatis.annotations.*;


import java.util.List;

@Mapper
public interface CommentMapper {

    @Select("SELECT * FROM comment WHERE recipe_id = #{recipeId} ORDER BY created_at DESC")
    List<Comment> findByRecipeId(Integer recipeId);

    @Select("SELECT * FROM comment WHERE id = #{id}")
    Comment findById(Integer id);

    @Insert("INSERT INTO comment (user_id, recipe_id, content, rating, likes) " +
            "VALUES (#{userId}, #{recipeId}, #{content}, #{rating}, 0)")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Comment comment);

    @Delete("DELETE FROM comment WHERE id = #{id}")
    int deleteById(Integer id);

    @Update("UPDATE comment SET likes = likes + 1 WHERE id = #{id}")
    int incrementLikes(Integer id);

    @Update("UPDATE comment SET likes = GREATEST(likes - 1, 0) WHERE id = #{id}")
    int decrementLikes(Integer id);
    
    @Select("SELECT COUNT(*) FROM comment WHERE recipe_id = #{recipeId}")
    int countByRecipeId(Integer recipeId);
    
    @Select("SELECT AVG(rating) FROM comment WHERE recipe_id = #{recipeId}")
    Double getAverageRatingByRecipeId(Integer recipeId);
} 