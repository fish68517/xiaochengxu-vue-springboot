package com.animal.service;

import com.animal.mapper.CommentLikeMapper;
import com.animal.mapper.CommentMapper;
import com.animal.mapper.UserMapper;
import com.animal.model.Comment;
import com.animal.model.CommentDTO;
import com.animal.model.CommentLike;
import com.animal.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class CommentService {

    @Autowired
    private CommentMapper commentMapper;

    @Autowired
    private CommentLikeMapper commentLikeMapper;

    @Autowired
    private UserMapper userMapper;

    /**
     * 获取指定菜谱的所有评论
     * @param recipeId 菜谱ID
     * @return 评论DTO列表
     */
    public List<CommentDTO> getCommentsByRecipe(Integer recipeId) {
        List<Comment> comments = commentMapper.findByRecipeId(recipeId);
        List<CommentDTO> commentDTOs = new ArrayList<>();

        for (Comment comment : comments) {
            CommentDTO dto = new CommentDTO();
            dto.setId(comment.getId());
            dto.setContent(comment.getContent());
            dto.setRating(comment.getRating());
            dto.setLikes(comment.getLikes());
            dto.setCreatedAt(comment.getCreatedAt());
            dto.setUpdatedAt(comment.getUpdatedAt());
            
            // 获取用户信息
            User user = userMapper.findById(comment.getUserId());
            if (user != null) {
                dto.setUserId(user.getId());
                dto.setNickname(user.getNickname());
                dto.setUserAvatar(user.getAvatar());
            }
            
            commentDTOs.add(dto);
        }

        return commentDTOs;
    }

    /**
     * 添加评论
     * @param comment 评论数据
     * @return 添加的评论
     */
    @Transactional
    public Comment addComment(Comment comment) {
        commentMapper.insert(comment);
        return comment;
    }

    /**
     * 删除评论
     * @param commentId 评论ID
     * @param userId 用户ID
     * @return 是否删除成功
     */
    @Transactional
    public boolean deleteComment(Integer commentId, Integer userId) {
        Comment comment = commentMapper.findById(commentId);
        
        // 检查评论是否存在且用户是否有权限删除
        if (comment == null || (!Objects.equals(comment.getUserId(), userId) && !isAdmin(userId))) {
            return false;
        }
        
        // 删除评论相关的点赞记录
        commentLikeMapper.deleteByCommentId(commentId);
        
        // 删除评论
        commentMapper.deleteById(commentId);
        return true;
    }

    /**
     * 点赞评论
     * @param commentId 评论ID
     * @param userId 用户ID
     * @return 点赞记录
     */
    @Transactional
    public CommentLike likeComment(Integer commentId, Integer userId) {
        // 检查是否已点赞
        CommentLike existingLike = commentLikeMapper.findByUserIdAndCommentId(userId, commentId);
        if (existingLike != null) {
            return existingLike;
        }
        
        // 新增点赞记录
        CommentLike like = new CommentLike();
        like.setUserId(userId);
        like.setCommentId(commentId);
        commentLikeMapper.insert(like);
        
        // 更新评论的点赞数
        commentMapper.incrementLikes(commentId);
        
        return like;
    }

    /**
     * 取消点赞评论
     * @param commentId 评论ID
     * @param userId 用户ID
     * @return 是否取消成功
     */
    @Transactional
    public boolean unlikeComment(Integer commentId, Integer userId) {
        CommentLike like = commentLikeMapper.findByUserIdAndCommentId(userId, commentId);
        if (like == null) {
            return false;
        }
        
        // 删除点赞记录
        commentLikeMapper.deleteById(like.getId());
        
        // 更新评论的点赞数
        commentMapper.decrementLikes(commentId);
        
        return true;
    }

    /**
     * 检查用户是否已点赞评论
     * @param commentId 评论ID
     * @param userId 用户ID
     * @return 是否已点赞
     */
    public boolean isCommentLiked(Integer commentId, Integer userId) {
        CommentLike like = commentLikeMapper.findByUserIdAndCommentId(userId, commentId);
        return like != null;
    }

    /**
     * 检查用户是否为管理员
     * @param userId 用户ID
     * @return 是否为管理员
     */
    private boolean isAdmin(Integer userId) {
        User user = userMapper.findById(userId);
        return user != null && "admin".equals(user.getRole());
    }
} 