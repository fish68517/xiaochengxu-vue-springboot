package com.animal.mapper;

import com.animal.model.CommentLike;
import org.apache.ibatis.annotations.*;


@Mapper
public interface CommentLikeMapper {

    @Select("SELECT * FROM comment_like WHERE user_id = #{userId} AND comment_id = #{commentId}")
    CommentLike findByUserIdAndCommentId(@Param("userId") Integer userId, @Param("commentId") Integer commentId);

    @Insert("INSERT INTO comment_like (user_id, comment_id) VALUES (#{userId}, #{commentId})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(CommentLike commentLike);

    @Delete("DELETE FROM comment_like WHERE id = #{id}")
    int deleteById(Integer id);

    @Delete("DELETE FROM comment_like WHERE comment_id = #{commentId}")
    int deleteByCommentId(Integer commentId);
    
    @Delete("DELETE FROM comment_like WHERE user_id = #{userId} AND comment_id = #{commentId}")
    int deleteByUserIdAndCommentId(@Param("userId") Integer userId, @Param("commentId") Integer commentId);
    
    @Select("SELECT COUNT(*) FROM comment_like WHERE comment_id = #{commentId}")
    int countByCommentId(Integer commentId);
} 