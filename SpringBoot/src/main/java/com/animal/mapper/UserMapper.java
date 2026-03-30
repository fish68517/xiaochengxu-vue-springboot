package com.animal.mapper;

import com.animal.model.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    @Select("SELECT * FROM user WHERE id = #{id}")
    User findById(Integer id);

    @Insert("INSERT INTO user(username, password, nickname, role) VALUES(#{username}, #{password}, #{nickname}, #{role})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(User user);


    @Delete("DELETE FROM user WHERE id = #{id}")
    int delete(Integer id);

    @Select("SELECT * FROM users WHERE role = #{role} AND status = 1")
    List<User> selectActiveUsersByRole( String role);


    @Select("SELECT COUNT(*) FROM user " +
            "WHERE username LIKE CONCAT('%', #{query}, '%') " +
            "OR nickname LIKE CONCAT('%', #{query}, '%')")
    int count(@Param("query") String query);

    @Select("SELECT * FROM user " +
            "WHERE username LIKE CONCAT('%', #{query}, '%') " +
            "OR nickname LIKE CONCAT('%', #{query}, '%') " +
            "ORDER BY id DESC " +
            "LIMIT #{offset}, #{pageSize}")
    List<User> findByPage(
            @Param("offset") Integer offset,
            @Param("pageSize") Integer pageSize,
            @Param("query") String query);

    @Select("SELECT * FROM user WHERE username = #{username}")
    User findByUsername(String username);

    @Update("UPDATE user SET password = #{password} WHERE id = #{id}")
    int updatePassword(@Param("id") Integer id, @Param("password") String password);


    @Select("SELECT * FROM user")
    List<User> findAll();

    @Update("<script>" +
            "UPDATE user SET " +
            "<if test='nickname != null'>nickname = #{nickname},</if>" +
            "<if test='avatar != null'>avatar = #{avatar},</if>" +
            "<if test='bmi != null'>bmi = #{bmi},</if>" +
            "<if test='height != null'>height = #{height},</if>" +
            "<if test='weight != null'>weight = #{weight},</if>" +
            "<if test='tastePreference != null'>taste_preference = #{tastePreference},</if>" +
            "<if test='dietaryRestriction != null'>dietary_restriction = #{dietaryRestriction},</if>" +
            "<if test='cookingSkill != null'>cooking_skill = #{cookingSkill},</if>" +
            "updated_at = NOW() " +
            "WHERE id = #{id}" +
            "</script>")
    int update(User user);
} 