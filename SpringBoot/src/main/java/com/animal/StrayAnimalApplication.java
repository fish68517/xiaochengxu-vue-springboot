package com.animal;

import org.mybatis.spring.annotation.MapperScan;  // 使用这个包
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;


@SpringBootApplication
@MapperScan("com.animal.mapper")
public class StrayAnimalApplication {
    public static void main(String[] args) {
        SpringApplication.run(StrayAnimalApplication.class, args);
    }
} 