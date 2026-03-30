package com.animal.service;

import com.animal.mapper.CartMapper;
import com.animal.mapper.FavoriteMapper;
import com.animal.mapper.OrderMapper;
import com.animal.mapper.RecipeMapper;
import com.animal.model.Recipe;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;


import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecommendService {

    @Autowired
    private CartMapper cartMapper;

    @Autowired
    private FavoriteMapper favoriteMapper;

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private RecipeMapper recipeMapper;

    // 推荐权重
    private static final double ORDER_WEIGHT = 5.0;
    private static final double FAVORITE_WEIGHT = 3.0;
    private static final double CART_WEIGHT = 1.0;

    /**
     * 为指定用户推荐菜品
     * @param userId 用户ID
     * @return 推荐的菜品列表
     */
    public List<Recipe> recommendRecipes(Integer userId) {
        // 获取所有用户行为数据
        Map<Integer, Map<Integer, Double>> userRecipeScores = getUserRecipeScores();

        if (!userRecipeScores.containsKey(userId)) {
            // 新用户没有行为记录，返回热门菜品
           return getPopularRecipes();
        }

        // 获取当前用户的菜品评分
        Map<Integer, Double> userScores = userRecipeScores.get(userId);

        // 计算用户相似度
        Map<Integer, Double> userSimilarity = calculateUserSimilarity(userId, userRecipeScores);

        // 获取推荐菜品
        Set<Integer> userViewedRecipes = userScores.keySet();
        Map<Integer, Double> recommendScores = new HashMap<>();

        // 基于用户相似度计算推荐得分
        for (Map.Entry<Integer, Double> entry : userSimilarity.entrySet()) {
            Integer otherUserId = entry.getKey();
            Double similarity = entry.getValue();

            if (similarity <= 0) continue;

            Map<Integer, Double> otherUserScores = userRecipeScores.get(otherUserId);
            for (Map.Entry<Integer, Double> recipeScore : otherUserScores.entrySet()) {
                Integer recipeId = recipeScore.getKey();
                Double score = recipeScore.getValue();

                // 跳过用户已经交互过的菜品
                if (userViewedRecipes.contains(recipeId)) continue;

                recommendScores.put(recipeId,
                        recommendScores.getOrDefault(recipeId, 0.0) + similarity * score);
            }
        }

        // 获取推荐菜品列表
        List<Integer> recommendedRecipeIds = recommendScores.entrySet().stream()
                .sorted(Map.Entry.<Integer, Double>comparingByValue().reversed())
                .limit(10)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        // 如果推荐数量不足，补充热门菜品
        if (recommendedRecipeIds.size() < 10) {
            List<Recipe> popularRecipes = getPopularRecipes();
            for (Recipe recipe : popularRecipes) {
                if (!recommendedRecipeIds.contains(recipe.getId()) &&
                        !userViewedRecipes.contains(recipe.getId())) {
                    recommendedRecipeIds.add(recipe.getId());
                    if (recommendedRecipeIds.size() >= 10) break;
                }
            }
        }

        // 获取菜品详情
        List<Recipe> recommendedRecipes = new ArrayList<>();
        for (Integer recipeId : recommendedRecipeIds) {
            Recipe recipe = recipeMapper.findById(recipeId);
            if (recipe != null) {
                recommendedRecipes.add(recipe);
            }
        }

        return recommendedRecipes;
    }

    /**
     * 获取所有用户对菜品的评分
     * @return 用户-菜品-评分的映射
     */
    private Map<Integer, Map<Integer, Double>> getUserRecipeScores() {
        Map<Integer, Map<Integer, Double>> userRecipeScores = new HashMap<>();

        // 收集订单数据
        // 这里简化实现，真实情况下需要更复杂的查询
        Map<Integer, Set<Integer>> userOrderRecipes = new HashMap<>();
        // 从订单和订单详情中收集数据

        // 收集收藏数据
        Map<Integer, Set<Integer>> userFavoriteRecipes = new HashMap<>();
        // 从收藏表中收集数据

        // 收集购物车数据
        Map<Integer, Set<Integer>> userCartRecipes = new HashMap<>();
        // 从购物车表中收集数据

        // 组合所有数据计算最终评分
        for (Map.Entry<Integer, Set<Integer>> entry : userOrderRecipes.entrySet()) {
            Integer userId = entry.getKey();
            Set<Integer> recipeIds = entry.getValue();

            Map<Integer, Double> recipeScores = userRecipeScores.computeIfAbsent(
                    userId, k -> new HashMap<>());

            for (Integer recipeId : recipeIds) {
                recipeScores.put(recipeId,
                        recipeScores.getOrDefault(recipeId, 0.0) + ORDER_WEIGHT);
            }
        }

        // 处理收藏数据
        for (Map.Entry<Integer, Set<Integer>> entry : userFavoriteRecipes.entrySet()) {
            Integer userId = entry.getKey();
            Set<Integer> recipeIds = entry.getValue();

            Map<Integer, Double> recipeScores = userRecipeScores.computeIfAbsent(
                    userId, k -> new HashMap<>());

            for (Integer recipeId : recipeIds) {
                recipeScores.put(recipeId,
                        recipeScores.getOrDefault(recipeId, 0.0) + FAVORITE_WEIGHT);
            }
        }

        // 处理购物车数据
        for (Map.Entry<Integer, Set<Integer>> entry : userCartRecipes.entrySet()) {
            Integer userId = entry.getKey();
            Set<Integer> recipeIds = entry.getValue();

            Map<Integer, Double> recipeScores = userRecipeScores.computeIfAbsent(
                    userId, k -> new HashMap<>());

            for (Integer recipeId : recipeIds) {
                recipeScores.put(recipeId,
                        recipeScores.getOrDefault(recipeId, 0.0) + CART_WEIGHT);
            }
        }

        // 打印 userRecipeScores
        System.out.println("用户-菜品-评分映射：" +userRecipeScores);

        return userRecipeScores;
    }

    /**
     * 计算用户相似度
     * @param userId 当前用户ID
     * @param userRecipeScores 所有用户的菜品评分
     * @return 用户相似度映射
     */
    private Map<Integer, Double> calculateUserSimilarity(
            Integer userId, Map<Integer, Map<Integer, Double>> userRecipeScores) {
        Map<Integer, Double> similarity = new HashMap<>();
        Map<Integer, Double> userScores = userRecipeScores.get(userId);

        for (Map.Entry<Integer, Map<Integer, Double>> entry : userRecipeScores.entrySet()) {
            Integer otherUserId = entry.getKey();
            if (userId.equals(otherUserId)) continue;

            Map<Integer, Double> otherUserScores = entry.getValue();

            // 使用余弦相似度计算用户相似度
            double dotProduct = 0.0;
            for (Map.Entry<Integer, Double> scoreEntry : userScores.entrySet()) {
                Integer recipeId = scoreEntry.getKey();
                Double score = scoreEntry.getValue();

                if (otherUserScores.containsKey(recipeId)) {
                    dotProduct += score * otherUserScores.get(recipeId);
                }
            }

            double userMagnitude = Math.sqrt(
                    userScores.values().stream().mapToDouble(score -> score * score).sum());
            double otherUserMagnitude = Math.sqrt(
                    otherUserScores.values().stream().mapToDouble(score -> score * score).sum());

            double similarityScore = 0.0;
            if (userMagnitude > 0 && otherUserMagnitude > 0) {
                similarityScore = dotProduct / (userMagnitude * otherUserMagnitude);
            }

            similarity.put(otherUserId, similarityScore);
        }

        return similarity;
    }

    /**
     * 获取热门菜品
     * @return 热门菜品列表
     */
    private List<Recipe> getPopularRecipes() {
        // 简化实现，实际应基于订单和收藏等数据计算热门菜品
        // 随机取10个菜品
        List<Recipe> popularRecipes = new ArrayList<>();
        List<Recipe> allRecipes = recipeMapper.findAll();
        Collections.shuffle(allRecipes);
        // 如果没有10个菜谱，则取所有菜谱
        if (allRecipes.size() < 10) {
            popularRecipes.addAll(allRecipes);
        } else {
            popularRecipes.addAll(allRecipes.subList(0, 10));
        }

        return popularRecipes;
    }


}