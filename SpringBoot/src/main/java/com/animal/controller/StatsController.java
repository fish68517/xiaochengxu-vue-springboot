package com.animal.controller;

import com.animal.mapper.StatsMapper;
import com.animal.model.DashboardStats;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/stats")
public class StatsController {
    @Autowired
    private StatsMapper statsMapper;

    @GetMapping("/dashboard")
    public DashboardStats getDashboardStats() {
        DashboardStats stats = new DashboardStats();
        
        // 用户统计
        stats.setUserCount(statsMapper.getUserCount());
        stats.setUserIncrease(statsMapper.getTodayUserCount());
        
        // 订单统计
        stats.setOrderCount(statsMapper.getOrderCount());
        stats.setOrderIncrease(statsMapper.getTodayOrderCount());
        
        // 菜品统计
        stats.setRecipeCount(statsMapper.getRecipeCount());
        stats.setRecipeIncrease(statsMapper.getTodayRecipeCount());
        
        // 评价统计
        stats.setReviewCount(statsMapper.getReviewCount());
        stats.setReviewIncrease(statsMapper.getTodayReviewCount());
        
        return stats;
    }
} 