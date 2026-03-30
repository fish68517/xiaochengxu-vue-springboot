package com.animal.controller;

import com.animal.mapper.UserMapper;
import com.animal.model.Result;
import com.animal.model.User;
import com.animal.service.UserService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired
    private UserMapper userMapper;

    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public User getUserById(@RequestParam Integer userId, @PathVariable Integer id) {
        return userMapper.findById(id);
    }

    @GetMapping("/info")
    public User getUserByUserId(@RequestParam("userId") Integer userId) {
        return userMapper.findById(userId);
    }

    // 注册接口不需要 userId
    @PostMapping("")
    public ResponseEntity<?> createUser(@RequestBody User user) {
        User existing = userMapper.findByUsername(user.getUsername());
        if (existing != null) {
            return ResponseEntity.badRequest().body("用户名已存在");
        }
        if (user.getRole() == null || user.getRole().trim().isEmpty()) {
            user.setRole("user");
        }
        userMapper.insert(user);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/info")
    public ResponseEntity<?> updateUserInfo(
            @RequestParam Integer userId,
            @RequestBody User user) {
        User existingUser = userMapper.findById(userId);
        if (existingUser == null) {
            return ResponseEntity.notFound().build();
        }

        user.setId(userId);
        user.setPassword(existingUser.getPassword());
        userMapper.update(user);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{id}")
    public User updateUser(@RequestParam Integer userId, @PathVariable Integer id, @RequestBody User user) {
        user.setId(id);
        userMapper.update(user);
        return user;
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@RequestParam Integer userId, @PathVariable Integer id) {
        userMapper.delete(id);
    }

    // 登录接口不需要 userId
    @PostMapping("/login")
    public Result login(@RequestBody User user) {
        User existUser = userMapper.selectOne(
                new QueryWrapper<User>()
                        .eq("username", user.getUsername())
                        .eq("password", user.getPassword())
        );
        if (existUser != null) {
            if (user.getRole() != null
                    && !user.getRole().isEmpty()
                    && !user.getRole().equals(existUser.getRole())) {
                return Result.error("角色不匹配");
            }
            return Result.success(existUser);
        }
        return Result.error("用户名或密码错误");
    }

    @GetMapping
    public ResponseEntity<?> getUsers(
            @RequestParam Integer userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String query) {
        int offset = (page - 1) * pageSize;
        int total = userMapper.count(query);
        List<User> users = userMapper.findByPage(offset, pageSize, query);

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("data", users);

        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> updatePassword(
            @RequestParam Integer userId,
            @PathVariable Integer id,
            @RequestBody Map<String, String> body) {
        User user = userMapper.findById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String oldPassword = body.get("oldPassword");
        String newPassword = body.get("newPassword");

        if (!user.getPassword().equals(oldPassword)) {
            return ResponseEntity.badRequest().body("旧密码错误");
        }

        userMapper.updatePassword(id, newPassword);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        return ResponseEntity.ok().build();
    }

    @PostMapping("/uploadAvatar")
    public ResponseEntity<?> uploadAvatar(
            @RequestAttribute Integer userId,
            @RequestParam("file") MultipartFile file) {
        try {
            String avatarUrl = userService.uploadAvatar(userId, file);
            return ResponseEntity.ok().body(Map.of("message", "头像上传成功", "data", avatarUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "头像上传失败: " + e.getMessage()));
        }
    }
}
