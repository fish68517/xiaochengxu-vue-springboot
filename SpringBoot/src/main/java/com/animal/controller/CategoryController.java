package com.animal.controller;

import com.animal.mapper.CategoryMapper;
import com.animal.model.Category;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    @Autowired
    private CategoryMapper categoryMapper;

    @GetMapping
    public List<Category> getAllCategories() {
        return categoryMapper.findAll();
    }

    @GetMapping("/{id}")
    public Category getCategoryById(@PathVariable Integer id) {
        return categoryMapper.findById(id);
    }

    @PostMapping
    public Category createCategory(@RequestBody Category category) {
        categoryMapper.insert(category);
        return category;
    }

    @PutMapping("/{id}")
    public Category updateCategory(@PathVariable Integer id, @RequestBody Category category) {
        category.setId(id);
        categoryMapper.update(category);
        return category;
    }

    @DeleteMapping("/{id}")
    public void deleteCategory(@PathVariable Integer id) {
        categoryMapper.delete(id);
    }
} 