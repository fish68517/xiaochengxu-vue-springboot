package com.animal.mapper;

import com.animal.model.OrderDetail;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface OrderDetailMapper {
    @Select("SELECT od.*, r.name as 'recipe.name', r.image as 'recipe.image', r.merchant_id as 'recipe.merchantId' " +
            "FROM order_detail od " +
            "LEFT JOIN recipe r ON od.recipe_id = r.id " +
            "WHERE od.order_id = #{orderId}")
    List<OrderDetail> findByOrderId(Integer orderId);

    @Insert("INSERT INTO order_detail(order_id, recipe_id, quantity, price) " +
            "VALUES(#{orderId}, #{recipeId}, #{quantity}, #{price})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(OrderDetail orderDetail);
} 
