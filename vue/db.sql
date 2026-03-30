-- 创建数据库
CREATE DATABASE IF NOT EXISTS recipe_system DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;

USE recipe_system;

-- 用户表
CREATE TABLE user (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    avatar VARCHAR(255),
    role ENUM('user', 'merchant', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 菜品分类表
CREATE TABLE category (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0
);

-- 菜品表
CREATE TABLE recipe (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT,
    merchant_id INT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    ingredients TEXT NOT NULL,
    steps TEXT NOT NULL,
    image VARCHAR(255),
    cooking_time INT COMMENT '烹饪时间(分钟)',
    difficulty ENUM('简单', '中等', '困难') DEFAULT '中等',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES category(id),
    FOREIGN KEY (merchant_id) REFERENCES user(id)
);

-- 购物车表
CREATE TABLE cart (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    recipe_id INT,
    quantity INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(id)
);

-- 订单表
CREATE TABLE `order` (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('待付款', '已付款', '已完成', '已取消') DEFAULT '待付款',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id)
);

-- 订单详情表
CREATE TABLE order_detail (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT,
    recipe_id INT,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES `order`(id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(id)
);

-- 评价表
CREATE TABLE review (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    recipe_id INT,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(id)
);

-- 用户收藏表
CREATE TABLE favorite (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    recipe_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(id),
    UNIQUE KEY unique_favorite (user_id, recipe_id)
);

-- 插入一些测试数据
INSERT INTO user (username, password, nickname, role) VALUES
('admin', 'e10adc3949ba59abbe56e057f20f883e', '管理员', 'admin'),
('user1', 'e10adc3949ba59abbe56e057f20f883e', '测试用户', 'user');

INSERT INTO category (name, description) VALUES
('川菜', '四川特色菜系'),
('粤菜', '广东特色菜系'),
('苏菜', '江苏特色菜系');

-- 插入菜品数据
INSERT INTO recipe (category_id, name, description, ingredients, steps, cooking_time, difficulty) VALUES
(1, '麻婆豆腐', '四川传统名菜，麻辣鲜香', '豆腐 300g, 猪肉末 100g, 豆瓣酱 2勺, 花椒 适量, 葱花 适量', '1. 豆腐切块\n2. 肉末爆香\n3. 加入豆瓣酱炒制\n4. 加入豆腐翻炒\n5. 最后撒上花椒粉和葱花', 20, '简单'),
(1, '宫保鸡丁', '川菜经典，甜辣可口', '鸡胸肉 200g, 花生 50g, 干辣椒 适量, 葱姜蒜 适量', '1. 鸡肉切丁\n2. 爆香花生\n3. 炒制鸡丁\n4. 加入调味料\n5. 最后加入花生', 25, '中等'),
(2, '白切鸡', '粤式经典凉菜', '整鸡 1只, 姜片 适量, 葱 适量, 料酒 适量', '1. 鸡洗净\n2. 放入姜葱\n3. 煮至熟透\n4. 浸入冰水\n5. 切块装盘', 40, '中等'),
(3, '红烧狮子头', '苏菜代表作', '猪肉馅 500g, 豆腐 100g, 葱姜水 适量, 生抽老抽 适量', '1. 调制肉馅\n2. 搓制丸子\n3. 煎制上色\n4. 炖煮收汁\n5. 装盘即可', 50, '困难');

-- 插入购物车数据
INSERT INTO cart (user_id, recipe_id, quantity) VALUES
(2, 1, 2),
(2, 3, 1);

-- 插入订单数据
INSERT INTO `order` (user_id, order_no, total_amount, status) VALUES
(2, '202403150001', 128.00, '已完成'),
(2, '202403150002', 88.00, '待付款');

-- 插入订单详情数据
INSERT INTO order_detail (order_id, recipe_id, quantity, price) VALUES
(1, 1, 1, 48.00),
(1, 2, 1, 80.00),
(2, 3, 2, 44.00);

-- 插入评价数据
INSERT INTO review (user_id, recipe_id, rating, content) VALUES
(2, 1, 5, '麻婆豆腐很正宗，麻辣鲜香，很满意！'),
(2, 2, 4, '宫保鸡丁做得不错，就是有点偏甜。'),
(2, 3, 5, '白切鸡非常嫩滑，配上姜葱酱简直绝配！');

-- 插入收藏数据
INSERT INTO favorite (user_id, recipe_id) VALUES
(2, 1),
(2, 3),
(2, 4); 
