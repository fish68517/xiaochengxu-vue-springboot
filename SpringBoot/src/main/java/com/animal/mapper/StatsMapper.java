package com.animal.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface StatsMapper {
    // 用户统计
    @Select("SELECT COUNT(*) FROM user")
    int getUserCount();

    @Select("SELECT COUNT(*) FROM user WHERE DATE(created_at) = CURDATE()")
    int getTodayUserCount();

    // 订单统计
    @Select("SELECT COUNT(*) FROM `order`")
    int getOrderCount();

    @Select("SELECT COUNT(*) FROM `order` WHERE DATE(created_at) = CURDATE()")
    int getTodayOrderCount();

    // 菜品统计
    @Select("SELECT COUNT(*) FROM recipe")
    int getRecipeCount();

    @Select("SELECT COUNT(*) FROM recipe WHERE DATE(created_at) = CURDATE()")
    int getTodayRecipeCount();

    // 评价统计
    @Select("SELECT COUNT(*) FROM review")
    int getReviewCount();

    @Select("SELECT COUNT(*) FROM review WHERE DATE(created_at) = CURDATE()")
    int getTodayReviewCount();
}