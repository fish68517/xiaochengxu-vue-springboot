package com.animal.mapper;

import com.animal.model.Recipe;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface RecipeMapper {
    @Select("SELECT * FROM recipe")
    List<Recipe> findAll();

    @Select("SELECT * FROM recipe WHERE id = #{id}")
    Recipe findById(Integer id);

    @Select("SELECT * FROM recipe WHERE category_id = #{categoryId}")
    List<Recipe> findByCategoryId(Integer categoryId);

    @Insert("INSERT INTO recipe(category_id, merchant_id, window_id, name, description, ingredients, steps, cooking_time, image, difficulty, price) " +
            "VALUES(#{categoryId}, #{merchantId}, #{windowId}, #{name}, #{description}, #{ingredients}, #{steps}, #{cookingTime}, #{image}, #{difficulty}, #{price})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Recipe recipe);

    @Update("UPDATE recipe SET category_id = #{categoryId}, window_id = #{windowId}, name = #{name}, description = #{description}, ingredients = #{ingredients}, " +
            "steps = #{steps}, cooking_time = #{cookingTime}, image = #{image}, difficulty = #{difficulty}, price = #{price} WHERE id = #{id}")
    int update(Recipe recipe);

    @Delete("DELETE FROM recipe WHERE id = #{id}")
    int delete(Integer id);

    @Delete("DELETE FROM recipe WHERE id = #{id} AND merchant_id = #{merchantId}")
    int deleteByMerchant(@Param("id") Integer id, @Param("merchantId") Integer merchantId);

    @Select("SELECT * FROM recipe WHERE id = #{id} AND merchant_id = #{merchantId}")
    Recipe findByIdAndMerchant(@Param("id") Integer id, @Param("merchantId") Integer merchantId);

    @Select("SELECT * FROM recipe WHERE name LIKE CONCAT('%', #{keyword}, '%') " +
            "OR description LIKE CONCAT('%', #{keyword}, '%')")
    List<Recipe> searchRecipes(@Param("keyword") String keyword);



    @Select("<script>" +
            "SELECT COUNT(*) FROM recipe " +
            "<where>" +
            "<if test='merchantId != null'>merchant_id = #{merchantId}</if>" +
            "<if test='query != null and query != \"\"'> " +
            "AND (name LIKE CONCAT('%', #{query}, '%') OR description LIKE CONCAT('%', #{query}, '%'))" +
            "</if>" +
            "</where>" +
            "</script>")
    int count(@Param("query") String query, @Param("merchantId") Integer merchantId);

    @Select("<script>" +
            "SELECT r.*, c.name as 'category.name' " +
            "FROM recipe r " +
            "LEFT JOIN category c ON r.category_id = c.id " +
            "<where>" +
            "<if test='merchantId != null'>r.merchant_id = #{merchantId}</if>" +
            "<if test='query != null and query != \"\"'> " +
            "AND (r.name LIKE CONCAT('%', #{query}, '%') OR r.description LIKE CONCAT('%', #{query}, '%'))" +
            "</if>" +
            "</where> " +
            "ORDER BY r.id DESC " +
            "LIMIT #{offset}, #{pageSize}" +
            "</script>")
    List<Recipe> findByPage(
            @Param("offset") Integer offset,
            @Param("pageSize") Integer pageSize,
            @Param("query") String query,
            @Param("merchantId") Integer merchantId);

    @Select("SELECT r.* FROM recipe r " +
            "JOIN order_detail od ON od.recipe_id = r.id " +
            "GROUP BY r.id " +
            "ORDER BY SUM(od.quantity) DESC, COUNT(*) DESC " +
            "LIMIT #{limit}")
    List<Recipe> findHotRecipes(@Param("limit") Integer limit);
}
