package com.animal.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import java.util.Date;

@Data
public class User {
    private Integer id;
    private String username;
    private String password;
    private String nickname;
    private String avatar;
    private String role;
    private Date createdAt;
    private Date updatedAt;


    private String tastePreference;


    private String cookingSkill;


    private String dietaryRestriction;


    private Float height;


    private Float weight;


    private Float bmi;

} 