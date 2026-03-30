package com.animal.controller;

import com.animal.mapper.CartMapper;
import com.animal.mapper.RecipeMapper;
import com.animal.model.Cart;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cart")
public class CartController {
    @Autowired
    private CartMapper cartMapper;
    @Autowired
    private RecipeMapper recipeMapper;

    // 获取用户购物车列表
    @GetMapping("/user")
    public List<Cart> getUserCart(@RequestParam("userId") Integer userId) {
        return cartMapper.findByUserId(userId);
    }

    // 添加到购物车
    @PostMapping
    public ResponseEntity<?> addToCart(@RequestParam Integer userId, @RequestBody Cart cart) {
        cart.setUserId(userId);
        
        // 检查是否已存在
        Cart existingCart = cartMapper.findByUserIdAndRecipeId(userId, cart.getRecipeId());
        if (existingCart != null) {
            // 更新数量
            existingCart.setQuantity(existingCart.getQuantity() + cart.getQuantity());
            cartMapper.update(existingCart);
            return ResponseEntity.ok(existingCart);
        }

        // 新增
        cartMapper.insert(cart);
        return ResponseEntity.ok(cart);
    }

    // 更新购物车商品数量
    @PutMapping("/{id}")
    public ResponseEntity<?> updateCart(
            @PathVariable("id") Long id,
            @RequestParam("userId") Integer userId,
            @RequestBody Map<String, Integer> requestBody) {

        System.out.println("请求信息：" +requestBody);
        Cart existingCart = cartMapper.findById(Math.toIntExact(id));
        // 获取 quantity
        Integer quantity = requestBody.get("quantity");
        existingCart.setQuantity(quantity);
        cartMapper.update(existingCart);
        return ResponseEntity.ok(existingCart);
    }

    // 删除购物车商品
    @DeleteMapping("/{id}")
    public ResponseEntity<?> removeFromCart(
            @RequestParam Integer userId,
            @PathVariable Integer id) {
        // 验证权限
        Cart existingCart = cartMapper.findById(id);
        if (existingCart == null || !existingCart.getUserId().equals(userId)) {
            return ResponseEntity.status(403).body("无权限删除");
        }

        cartMapper.delete(id);
        return ResponseEntity.ok().build();
    }

    // 清空购物车
    @DeleteMapping("/user")
    public ResponseEntity<?> clearCart(@RequestParam Integer userId) {
        cartMapper.deleteByUserId(userId);
        return ResponseEntity.ok().build();
    }
} 