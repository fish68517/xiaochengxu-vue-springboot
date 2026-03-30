package com.animal.mapper;

import com.animal.model.Order;
import org.apache.ibatis.annotations.*;

import java.util.List;
import java.util.Map;

@Mapper
public interface OrderMapper {
    @Select("SELECT * FROM `order` ORDER BY created_at DESC")
    List<Order> findAllOrders();

    @Select("SELECT * FROM `order` WHERE user_id = #{userId} ORDER BY created_at DESC")
    List<Order> findByUserId(Integer userId);

    @Select("SELECT DISTINCT o.* FROM `order` o " +
            "JOIN order_detail od ON od.order_id = o.id " +
            "JOIN recipe r ON r.id = od.recipe_id " +
            "WHERE r.merchant_id = #{merchantId} " +
            "ORDER BY o.created_at DESC")
    List<Order> findByMerchantId(@Param("merchantId") Integer merchantId);

    @Select("SELECT * FROM `order` WHERE id = #{id}")
    Order findById(Integer id);

    @Insert("INSERT INTO `order`(user_id, order_no, pickup_code, remark, total_amount, status) " +
            "VALUES(#{userId}, #{orderNo}, #{pickupCode}, #{remark}, #{totalAmount}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Order order);

    @Update("UPDATE `order` SET status = #{status} WHERE id = #{id}")
    int updateStatus(Order order);

    // Count waiting orders by fixed window id. If window_id is empty, fallback to category_id.

    /*原来 countWaitingByMerchant 逻辑

    统计维度：recipe.merchant_id
    只统计状态为“待付款/已付款”的订单
    SQL 是按 merchant_id 分组后 COUNT(DISTINCT o.id)
    所以如果：

    菜品没分配 merchant_id，或者
    大部分菜品都属于同一个 merchant_id，
    就会出现你看到的“每个菜品等待人数几乎一样”。*/
    @Select("SELECT COALESCE(r.window_id, r.category_id) AS windowId, COUNT(DISTINCT o.id) AS waitingCount " +
            "FROM `order` o " +
            "JOIN order_detail od ON od.order_id = o.id " +
            "JOIN recipe r ON r.id = od.recipe_id " +
            "WHERE COALESCE(r.window_id, r.category_id) IS NOT NULL AND o.status IN ('待付款','已付款') " +
            "GROUP BY COALESCE(r.window_id, r.category_id)")
    List<Map<String, Object>> countWaitingByWindow();
}
