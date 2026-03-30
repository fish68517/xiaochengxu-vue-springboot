package com.animal.controller;

import com.animal.mapper.DiningWindowMapper;
import com.animal.model.DiningWindow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/windows")
public class DiningWindowController {
    @Autowired
    private DiningWindowMapper diningWindowMapper;

    @GetMapping
    public List<DiningWindow> getWindows() {
        return diningWindowMapper.findAllActive();
    }
}
