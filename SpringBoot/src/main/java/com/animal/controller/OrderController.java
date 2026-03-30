package com.animal.controller;

import com.animal.mapper.CartMapper;
import com.animal.mapper.OrderDetailMapper;
import com.animal.mapper.OrderMapper;
import com.animal.mapper.RecipeMapper;
import com.animal.mapper.UserMapper;
import com.animal.model.Order;
import com.animal.model.OrderDetail;
import com.animal.model.OrderItemRequest;
import com.animal.model.OrderRequest;
import com.animal.model.Recipe;
import com.animal.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private OrderDetailMapper orderDetailMapper;

    @Autowired
    private CartMapper cartMapper;

    @Autowired
    private RecipeMapper recipeMapper;

    @Autowired
    private UserMapper userMapper;

    @GetMapping("/user")
    public List<Order> getUserOrders(@RequestParam("userId") Integer userId) {
        List<Order> orders = orderMapper.findByUserId(userId);
        attachOrderDetails(orders);
        return orders;
    }

    @GetMapping("/admin")
    public ResponseEntity<?> getAdminOrders(@RequestParam("userId") Integer userId) {
        User operator = userMapper.findById(userId);
        if (operator == null || !"admin".equals(operator.getRole())) {
            return ResponseEntity.status(403).body("无权限");
        }
        List<Order> orders = orderMapper.findAllOrders();
        attachOrderDetails(orders);
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/merchant")
    public ResponseEntity<?> getMerchantOrders(@RequestParam("userId") Integer userId) {
        User operator = userMapper.findById(userId);
//        if (operator == null || !"merchant".equals(operator.getRole())) {
//            return ResponseEntity.status(403).body("无权限");
//        }
      //  List<Order> orders = orderMapper.findByMerchantId(userId);
        List<Order> orders = orderMapper.findAllOrders();
        for (Order order : orders) {
            List<OrderDetail> details = orderDetailMapper.findByOrderId(order.getId());
            List<OrderDetail> mine = new ArrayList<>();
            for (OrderDetail detail : details) {
                if (detail.getRecipe() != null && userId.equals(detail.getRecipe().getMerchantId())) {
                    mine.add(detail);
                }
            }
            order.setOrderDetails(mine);
        }
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{id}")
    public Order getOrderById(@PathVariable Integer id) {
        Order order = orderMapper.findById(id);
        if (order != null) {
            order.setOrderDetails(orderDetailMapper.findByOrderId(order.getId()));
        }
        return order;
    }

    @GetMapping("/waiting-count")
    public Map<Integer, Integer> getWaitingCount() {
        List<Map<String, Object>> rows = orderMapper.countWaitingByWindow();
        Map<Integer, Integer> result = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Integer windowId = ((Number) row.get("windowId")).intValue();
            Integer waitingCount = ((Number) row.get("waitingCount")).intValue();
            result.put(windowId, waitingCount);
        }
        return result;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createOrder(
            @RequestParam("userId") Integer userId,
            @RequestBody OrderRequest request) {
        Order order = new Order();
        order.setUserId(userId);
        order.setOrderNo(generateOrderNo());
        order.setPickupCode(generatePickupCode());
        order.setRemark(request.getRemark());
        order.setStatus("待付款");
        order.setCreatedAt(new Date());

        BigDecimal totalAmount = BigDecimal.ZERO;
        for (OrderItemRequest item : request.getItems()) {
            Recipe recipe = recipeMapper.findById(item.getRecipeId());
            if (recipe == null) {
                throw new RuntimeException("菜品不存在");
            }
        }
        if (totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            totalAmount = new BigDecimal(Math.random() * 100);
        }
        order.setTotalAmount(totalAmount);
        orderMapper.insert(order);

        for (OrderItemRequest item : request.getItems()) {
            OrderDetail detail = new OrderDetail();
            detail.setOrderId(order.getId());
            detail.setRecipeId(item.getRecipeId());
            detail.setQuantity(item.getQuantity());
            orderDetailMapper.insert(detail);
        }

        if (request.getCartItemIds() != null && !request.getCartItemIds().isEmpty()) {
            cartMapper.deleteByUserIdAndIds(userId, request.getCartItemIds());
        } else {
            cartMapper.deleteByUserId(userId);
        }
        return ResponseEntity.ok(order);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateOrderStatus(
            @RequestParam("userId") Integer userId,
            @PathVariable Integer id,
            @RequestBody Order order) {
        User operator = userMapper.findById(userId);
        if (operator == null) {
            return ResponseEntity.badRequest().body("用户不存在");
        }

        if ("merchant".equals(operator.getRole())) {
            List<OrderDetail> details = orderDetailMapper.findByOrderId(id);
            boolean belongsToMerchant = details.stream()
                    .anyMatch(d -> d.getRecipe() != null && userId.equals(d.getRecipe().getMerchantId()));
            if (!belongsToMerchant) {
                return ResponseEntity.status(403).body("无权操作该订单");
            }
        }

        order.setId(id);
        orderMapper.updateStatus(order);
        return ResponseEntity.ok(order);
    }

    private void attachOrderDetails(List<Order> orders) {
        for (Order order : orders) {
            order.setOrderDetails(orderDetailMapper.findByOrderId(order.getId()));
        }
    }

    private String generateOrderNo() {
        return "ORDER" + System.currentTimeMillis();
    }

    private String generatePickupCode() {
        int code = 100000 + new Random().nextInt(900000);
        return String.valueOf(code);
    }
}
