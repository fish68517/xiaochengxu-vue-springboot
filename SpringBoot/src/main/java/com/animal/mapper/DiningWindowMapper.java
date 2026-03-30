package com.animal.mapper;

import com.animal.model.DiningWindow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DiningWindowMapper {
    @Select("SELECT * FROM dining_window WHERE status = 1 ORDER BY sort_order ASC, id ASC")
    List<DiningWindow> findAllActive();
}
