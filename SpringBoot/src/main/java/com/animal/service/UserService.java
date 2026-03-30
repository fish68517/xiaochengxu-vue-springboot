package com.animal.service;

import com.animal.mapper.CartMapper;
import com.animal.mapper.UserMapper;
import com.animal.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.util.UUID;

@Service
public class UserService {

    @Autowired
    private UserMapper userMapper;


    /**
     * 根据ID获取用户
     * @param id 用户ID
     * @return 用户信息
     */
    public User getUserById(Integer id) {
        return userMapper.findById(id);
    }

    /**
     * 更新用户信息
     * @param user 用户信息
     * @return 是否更新成功
     */
    public boolean updateUser(User user) {
        // 确保不更新敏感字段
        user.setPassword(null);
        user.setUsername(null);
        user.setRole(null);
        
        return userMapper.update(user) > 0;
    }
    
    /**
     * 上传用户头像
     * @param userId 用户ID
     * @param file 头像文件
     * @return 头像URL
     */
    public String uploadAvatar(Integer userId, MultipartFile file) throws Exception {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("文件不能为空");
        }
        
        // 获取文件名和扩展名
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String filename = UUID.randomUUID().toString() + extension;
        
        // 确保目录存在
        String uploadDir = "uploads/avatars/";
        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        
        // 保存文件
        String filePath = uploadDir + filename;
        File dest = new File(filePath);
        file.transferTo(dest);
        
        // 更新用户头像URL
        User user = new User();
        user.setId(userId);
        user.setAvatar(filePath);
        userMapper.update(user);
        
        return filePath;
    }
} 