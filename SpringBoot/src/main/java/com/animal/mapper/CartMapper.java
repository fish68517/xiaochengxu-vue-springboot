package com.animal.mapper;

import com.animal.model.Cart;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface CartMapper {
    @Select("SELECT c.*, r.name as 'recipe.name', r.description as 'recipe.description', " +
            "r.image as 'recipe.image', r.price as 'recipe.price' " +
            "FROM cart c " +
            "LEFT JOIN recipe r ON c.recipe_id = r.id " +
            "WHERE c.user_id = #{userId}")
    List<Cart> findByUserId(Integer userId);

    @Select("SELECT * FROM cart WHERE id = #{id}")
    Cart findById(Integer id);

    @Select("SELECT * FROM cart WHERE user_id = #{userId} AND recipe_id = #{recipeId}")
    Cart findByUserIdAndRecipeId(@Param("userId") Integer userId, @Param("recipeId") Integer recipeId);

    @Insert("INSERT INTO cart(user_id, recipe_id, quantity) VALUES(#{userId}, #{recipeId}, #{quantity})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Cart cart);

    @Update("UPDATE cart SET quantity = #{quantity} WHERE id = #{id}")
    int update(Cart cart);

    @Delete("DELETE FROM cart WHERE id = #{id}")
    int delete(Integer id);

    @Delete("DELETE FROM cart WHERE user_id = #{userId}")
    int deleteByUserId(Integer userId);

    @Delete("<script>" +
            "DELETE FROM cart WHERE user_id = #{userId} AND id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>" +
            "#{id}" +
            "</foreach>" +
            "</script>")
    int deleteByUserIdAndIds(@Param("userId") Integer userId, @Param("ids") List<Integer> ids);
}
