package com.animal.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {

        // 获取当前项目的根目录工作路径 (推荐这种写法，使用绝对路径更稳妥)
        String projectPath = System.getProperty("user.dir");

        registry.addResourceHandler("/image/**")
                // 使用 file: 前缀指向文件系统，映射到项目根目录下的 image 文件夹
                .addResourceLocations("file:" + projectPath + "/image/");

        // 或者你也可以使用简单的相对路径写法（前提是启动时的工作目录就是项目根目录）：
        // .addResourceLocations("file:image/");
    }
}