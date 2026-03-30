package com.animal.mapper;

import com.animal.model.Review;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface ReviewMapper {
    @Select("SELECT r.*, u.nickname as 'user.nickname', u.avatar as 'user.avatar' " +
            "FROM review r " +
            "LEFT JOIN user u ON r.user_id = u.id " +
            "WHERE r.recipe_id = #{recipeId} " +
            "ORDER BY r.created_at DESC")
    List<Review> findByRecipeId(Integer recipeId);

    @Select("SELECT * FROM review WHERE id = #{id}")
    Review findById(Integer id);

    @Insert("INSERT INTO review(user_id, recipe_id, rating, content) " +
            "VALUES(#{userId}, #{recipeId}, #{rating}, #{content})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Review review);

    @Update("UPDATE review SET rating = #{rating}, content = #{content} WHERE id = #{id}")
    int update(Review review);

    @Delete("DELETE FROM review WHERE id = #{id}")
    int delete(Integer id);

    // 新增接口
    @Select("SELECT COUNT(*) FROM review WHERE content LIKE CONCAT('%', #{query}, '%')")
    int count(@Param("query") String query);

/*
    @Select("SELECT r.*, u.nickname as 'user.nickname', u.avatar as 'user.avatar' " +
            "FROM review r " +
            "LEFT JOIN user u ON r.user_id = u.id " +
            "WHERE r.content LIKE CONCAT('%', #{query}, '%') " +
            "ORDER BY r.created_at DESC " +
            "LIMIT #{offset}, #{pageSize}")
    List<Review> findByPage(@Param("offset") int offset, @Param("pageSize") int pageSize, @Param("query") String query);
*/

    @Select("SELECT r.*, u.nickname as 'user.nickname', u.avatar as 'user.avatar', " +
            "re.id as 'recipe.id', re.category_id as 'recipe.categoryId', re.name as 'recipe.name', " +
            "re.description as 'recipe.description', re.ingredients as 'recipe.ingredients', " +
            "re.steps as 'recipe.steps', re.image as 'recipe.image', re.cooking_time as 'recipe.cookingTime', " +
            "re.difficulty as 'recipe.difficulty', re.created_at as 'recipe.createdAt', re.price as 'recipe.price' " +
            "FROM review r " +
            "LEFT JOIN user u ON r.user_id = u.id " +
            "LEFT JOIN recipe re ON r.recipe_id = re.id " +
            "WHERE r.content LIKE CONCAT('%', #{query}, '%') " +
            "ORDER BY r.created_at DESC " +
            "LIMIT #{offset}, #{pageSize}")
    List<Review> findByPage(@Param("offset") int offset, @Param("pageSize") int pageSize, @Param("query") String query);
} 