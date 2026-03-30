package com.animal.controller;

// 请注意这里引入你项目中实际的 Result 路径 (根据你上传的文件，它可能在 com.animal.model.Result)
import com.animal.model.Result;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 文件上传控制器
 */
@RestController
@RequestMapping("/api/upload")
public class UploadController {

    /**
     * 处理图片上传
     * 保存路径: 项目根目录/image/pet/
     */
    @PostMapping("/image")
    public Result uploadImage(@RequestParam("file") MultipartFile file) { // 👈 核心修改1：去掉 Result 的泛型
        if (file.isEmpty()) {
            return Result.error("上传文件不能为空");
        }

        try {
            // 1. 获取当前项目运行的根目录路径
            String projectPath = System.getProperty("user.dir");
            // 拼接目标文件夹路径: 根目录/image/pet
            String uploadDir = projectPath + File.separator + "image" + File.separator + "pet";

            // 2. 如果目录不存在，则自动创建目录
            File dir = new File(uploadDir);
            if (!dir.exists()) {
                dir.mkdirs();
            }

            // 3. 提取原文件名后缀，并使用 UUID 生成新的唯一文件名 (防止文件重名覆盖)
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + extension;

            // 4. 将前端传来的文件写入本地物理硬盘
            File dest = new File(uploadDir + File.separator + newFilename);
            file.transferTo(dest);

            // 5. 拼装前端可以访问的相对 URL 路径 (配合你之前配置的 WebConfig)
            String imageUrl = "/image/pet/" + newFilename;

            // 6. 封装返回结果的数据载体
            Map<String, String> responseData = new HashMap<>();
            responseData.put("url", imageUrl);

            System.out.println("图片上传成功，保存路径: " + dest.getAbsolutePath());


            // 👈 核心修改2：直接传入 data 对象，Result 类内部会自动封装 code=200 和 message="操作成功"
            return Result.success(responseData);

        } catch (IOException e) {
            System.out.println("图片上传失败: " + e.getMessage());

            return Result.error("图片上传失败，请检查服务器权限");
        }
    }
}