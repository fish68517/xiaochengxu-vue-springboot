-- MySQL dump 10.13  Distrib 8.0.36, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: pet_life_dev
-- ------------------------------------------------------
-- Server version	8.0.36

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `addresses`
--

DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `receiver_name` varchar(40) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `province` varchar(40) NOT NULL DEFAULT '',
  `city` varchar(40) NOT NULL DEFAULT '',
  `district` varchar(40) NOT NULL DEFAULT '',
  `detail` varchar(240) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `ix_addresses_user_id` (`user_id`),
  KEY `ix_addresses_is_default` (`is_default`),
  CONSTRAINT `addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `addresses`
--

LOCK TABLES `addresses` WRITE;
/*!40000 ALTER TABLE `addresses` DISABLE KEYS */;
INSERT INTO `addresses` VALUES (1,1,'本地联调用户','13800001234','广东省','深圳市','南山区','本地开发环境测试地址',1,'2026-08-20 15:16:56','2026-08-20 15:16:56');
/*!40000 ALTER TABLE `addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `alembic_version`
--

DROP TABLE IF EXISTS `alembic_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alembic_version`
--

LOCK TABLES `alembic_version` WRITE;
/*!40000 ALTER TABLE `alembic_version` DISABLE KEYS */;
INSERT INTO `alembic_version` VALUES ('0005_lottery_real_data');
/*!40000 ALTER TABLE `alembic_version` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `operator` varchar(60) NOT NULL,
  `action` varchar(80) NOT NULL,
  `resource_type` varchar(50) NOT NULL,
  `resource_id` varchar(60) NOT NULL,
  `detail` text NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_audit_logs_operator` (`operator`),
  KEY `ix_audit_logs_action` (`action`),
  KEY `ix_audit_logs_resource_type` (`resource_type`),
  KEY `ix_audit_logs_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'admin','CREATE','PRODUCT','7','联调测试商品','2026-08-17 09:19:02'),(2,'admin','UPDATE','PRODUCT','7','联调测试商品','2026-08-17 09:19:02'),(3,'admin','DELETE','PRODUCT','7','联调测试商品','2026-08-17 09:19:02'),(4,'admin','CREATE','LOTTERY_ACTIVITY','3','管理后台联调活动','2026-08-17 09:19:02'),(5,'admin','PUBLISH','LOTTERY_ACTIVITY','3','管理后台联调活动','2026-08-17 09:19:03'),(6,'admin','CREATE','PRODUCT','8','后台 UI 联调商品','2026-08-17 09:21:08'),(7,'admin','UPDATE','PRODUCT','8','后台 UI 联调商品','2026-08-17 09:21:22'),(8,'admin','SHIP','ORDER','1','顺丰速运:111111111111111','2026-08-17 09:30:23'),(9,'admin','CREATE','PRODUCT','9','小乌龟','2026-08-17 09:31:24');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cart_items`
--

DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_user_product` (`user_id`,`product_id`),
  KEY `ix_cart_items_user_id` (`user_id`),
  KEY `ix_cart_items_product_id` (`product_id`),
  CONSTRAINT `cart_items_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `cart_items_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart_items`
--

LOCK TABLES `cart_items` WRITE;
/*!40000 ALTER TABLE `cart_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coupons`
--

DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `threshold_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(10,2) NOT NULL,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `ix_coupons_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupons`
--

LOCK TABLES `coupons` WRITE;
/*!40000 ALTER TABLE `coupons` DISABLE KEYS */;
INSERT INTO `coupons` VALUES (1,'本地开发优惠券',29.00,10.00,'2026-08-19 15:16:56','2026-09-19 15:16:56',1,'2026-08-20 15:16:56','2026-08-20 15:16:56');
/*!40000 ALTER TABLE `coupons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `favorites`
--

DROP TABLE IF EXISTS `favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_favorite_user_product` (`user_id`,`product_id`),
  KEY `ix_favorites_user_id` (`user_id`),
  KEY `ix_favorites_product_id` (`product_id`),
  CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `favorites_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `favorites`
--

LOCK TABLES `favorites` WRITE;
/*!40000 ALTER TABLE `favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_records`
--

DROP TABLE IF EXISTS `inventory_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `change_quantity` int NOT NULL,
  `before_stock` int NOT NULL,
  `after_stock` int NOT NULL,
  `business_type` varchar(30) NOT NULL,
  `business_id` varchar(60) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `ix_inventory_records_product_id` (`product_id`),
  KEY `ix_inventory_records_business_type` (`business_type`),
  KEY `ix_inventory_records_business_id` (`business_id`),
  CONSTRAINT `inventory_records_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_records`
--

LOCK TABLES `inventory_records` WRITE;
/*!40000 ALTER TABLE `inventory_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lottery_activities`
--

DROP TABLE IF EXISTS `lottery_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lottery_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL,
  `subtitle` varchar(160) NOT NULL,
  `registration_start_at` datetime NOT NULL,
  `registration_end_at` datetime NOT NULL,
  `draw_at` datetime NOT NULL,
  `status` varchar(30) NOT NULL,
  `participant_count` int NOT NULL,
  `prizes_json` text NOT NULL,
  `rules_json` text NOT NULL,
  `winners_json` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_lottery_activities_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lottery_activities`
--

LOCK TABLES `lottery_activities` WRITE;
/*!40000 ALTER TABLE `lottery_activities` DISABLE KEYS */;
INSERT INTO `lottery_activities` VALUES (1,'春日萌宠抽奖季','活动通知已发布，快来报名参加','2026-08-15 09:18:29','2026-08-21 09:18:29','2026-08-22 11:18:29','REGISTERING',0,'[{\"level\": \"一等奖\", \"name\": \"萌宠用品礼包\", \"quantity\": 5, \"icon\": \"gift\"}, {\"level\": \"二等奖\", \"name\": \"乌龟专区优惠券\", \"quantity\": 10, \"icon\": \"coupon\"}, {\"level\": \"三等奖\", \"name\": \"兔兔专区优惠券\", \"quantity\": 20, \"icon\": \"coupon\"}, {\"level\": \"参与奖\", \"name\": \"萌宠积分 10 分\", \"quantity\": 100, \"icon\": \"points\"}]','[\"管理员发布活动通知和奖品信息\", \"用户在报名时间内免费报名参加\", \"到达开奖时间后由服务端自动开奖\", \"公布脱敏中奖名单，中奖用户联系管理员领奖\"]','[]'),(2,'暖冬萌宠幸运季','本期活动已圆满开奖','2026-08-05 09:18:29','2026-08-11 09:18:29','2026-08-12 09:18:29','CLOSED',0,'[{\"level\": \"一等奖\", \"name\": \"萌宠用品礼包\", \"quantity\": 5, \"icon\": \"gift\"}, {\"level\": \"二等奖\", \"name\": \"乌龟专区优惠券\", \"quantity\": 10, \"icon\": \"coupon\"}, {\"level\": \"三等奖\", \"name\": \"兔兔专区优惠券\", \"quantity\": 20, \"icon\": \"coupon\"}, {\"level\": \"参与奖\", \"name\": \"萌宠积分 10 分\", \"quantity\": 100, \"icon\": \"points\"}]','[\"管理员发布活动通知和奖品信息\", \"用户在报名时间内免费报名参加\", \"到达开奖时间后由服务端自动开奖\", \"公布脱敏中奖名单，中奖用户联系管理员领奖\"]','[]'),(3,'管理后台联调活动','验证活动创建和发布接口','2026-08-17 09:18:02','2026-08-19 09:19:02','2026-08-20 09:19:02','REGISTERING',0,'[{\"icon\": \"coupon\", \"name\": \"商城优惠券\", \"quantity\": 1, \"level\": \"一等奖\"}]','[\"用户在报名时间内免费报名\", \"到达开奖时间后开奖\"]','[]');
/*!40000 ALTER TABLE `lottery_activities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lottery_participants`
--

DROP TABLE IF EXISTS `lottery_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lottery_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_activity_user` (`activity_id`,`user_id`),
  KEY `ix_lottery_participants_activity_id` (`activity_id`),
  KEY `ix_lottery_participants_user_id` (`user_id`),
  CONSTRAINT `lottery_participants_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `lottery_activities` (`id`),
  CONSTRAINT `lottery_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lottery_participants`
--

LOCK TABLES `lottery_participants` WRITE;
/*!40000 ALTER TABLE `lottery_participants` DISABLE KEYS */;
/*!40000 ALTER TABLE `lottery_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lottery_prizes`
--

DROP TABLE IF EXISTS `lottery_prizes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lottery_prizes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL,
  `level_name` varchar(40) NOT NULL,
  `prize_name` varchar(100) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `ix_lottery_prizes_activity_id` (`activity_id`),
  CONSTRAINT `lottery_prizes_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `lottery_activities` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lottery_prizes`
--

LOCK TABLES `lottery_prizes` WRITE;
/*!40000 ALTER TABLE `lottery_prizes` DISABLE KEYS */;
INSERT INTO `lottery_prizes` VALUES (1,1,'一等奖','萌宠用品礼包',5,1),(2,1,'二等奖','乌龟专区优惠券',10,2),(3,1,'三等奖','兔兔专区优惠券',20,3),(4,1,'参与奖','萌宠积分 10 分',100,4),(5,2,'一等奖','萌宠用品礼包',5,1),(6,2,'二等奖','乌龟专区优惠券',10,2),(7,2,'三等奖','兔兔专区优惠券',20,3),(8,2,'参与奖','萌宠积分 10 分',100,4),(9,3,'一等奖','商城优惠券',1,1);
/*!40000 ALTER TABLE `lottery_prizes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lottery_winners`
--

DROP TABLE IF EXISTS `lottery_winners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lottery_winners` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_id` int NOT NULL,
  `participant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `prize_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_winner_activity_participant` (`activity_id`,`participant_id`),
  KEY `ix_lottery_winners_activity_id` (`activity_id`),
  KEY `ix_lottery_winners_participant_id` (`participant_id`),
  KEY `ix_lottery_winners_user_id` (`user_id`),
  KEY `ix_lottery_winners_prize_id` (`prize_id`),
  CONSTRAINT `lottery_winners_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `lottery_activities` (`id`),
  CONSTRAINT `lottery_winners_ibfk_2` FOREIGN KEY (`participant_id`) REFERENCES `lottery_participants` (`id`),
  CONSTRAINT `lottery_winners_ibfk_3` FOREIGN KEY (`prize_id`) REFERENCES `lottery_prizes` (`id`),
  CONSTRAINT `lottery_winners_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lottery_winners`
--

LOCK TABLES `lottery_winners` WRITE;
/*!40000 ALTER TABLE `lottery_winners` DISABLE KEYS */;
/*!40000 ALTER TABLE `lottery_winners` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `product_name` varchar(80) NOT NULL,
  `product_image_url` varchar(500) DEFAULT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL,
  `line_amount` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_order_items_order_id` (`order_id`),
  KEY `ix_order_items_product_id` (`product_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (1,1,1,'巴西龟（幼龟）',NULL,39.00,1,39.00);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_no` varchar(40) NOT NULL,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `product_name` varchar(80) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL,
  `discount` decimal(10,2) NOT NULL,
  `shipping_fee` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `status` varchar(30) NOT NULL,
  `address_name` varchar(40) NOT NULL,
  `address_phone` varchar(30) NOT NULL,
  `address_detail` varchar(240) NOT NULL,
  `created_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `shipping_company` varchar(60) DEFAULT NULL,
  `tracking_no` varchar(80) DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `coupon_id` int DEFAULT NULL,
  `payment_status` varchar(20) NOT NULL DEFAULT 'UNPAID',
  `remark` varchar(300) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT (now()),
  `cancelled_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_orders_order_no` (`order_no`),
  KEY `ix_orders_product_id` (`product_id`),
  KEY `ix_orders_user_id` (`user_id`),
  KEY `ix_orders_status` (`status`),
  KEY `ix_orders_payment_status` (`payment_status`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,'PL20260817091902C131D8',1,1,'巴西龟（幼龟）',39.00,1,0.00,0.00,39.00,'SHIPPED','本地联调用户','13800001234','本地开发环境测试地址','2026-08-17 09:19:03','2026-08-17 09:19:03','顺丰速运','111111111111111','2026-08-17 09:30:23',NULL,'PAID',NULL,'2026-08-20 15:16:23',NULL,NULL);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payment_no` varchar(50) NOT NULL,
  `order_id` int NOT NULL,
  `provider` varchar(20) NOT NULL DEFAULT 'MANUAL',
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `provider_transaction_id` varchar(100) DEFAULT NULL,
  `confirmed_by` int DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_no` (`payment_no`),
  UNIQUE KEY `ix_payments_payment_no` (`payment_no`),
  UNIQUE KEY `provider_transaction_id` (`provider_transaction_id`),
  KEY `confirmed_by` (`confirmed_by`),
  KEY `ix_payments_order_id` (`order_id`),
  KEY `ix_payments_status` (`status`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,'HISTORY-PL20260817091902C131D8',1,'MANUAL',39.00,'SUCCESS',NULL,NULL,'2026-08-17 09:19:03','2026-08-20 15:16:34','2026-08-20 15:16:34');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_categories`
--

DROP TABLE IF EXISTS `product_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `ix_product_categories_name` (`name`),
  KEY `ix_product_categories_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_categories`
--

LOCK TABLES `product_categories` WRITE;
/*!40000 ALTER TABLE `product_categories` DISABLE KEYS */;
INSERT INTO `product_categories` VALUES (1,'套餐',1,1,'2026-08-20 15:16:02','2026-08-20 15:16:02'),(2,'爬宠',2,1,'2026-08-20 15:16:02','2026-08-20 15:16:02'),(3,'用品',3,1,'2026-08-20 15:16:02','2026-08-20 15:16:02');
/*!40000 ALTER TABLE `product_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `category` varchar(20) NOT NULL,
  `subtitle` varchar(120) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `original_price` decimal(10,2) DEFAULT NULL,
  `sales` int NOT NULL,
  `stock` int NOT NULL,
  `image_key` varchar(30) NOT NULL,
  `badge` varchar(20) DEFAULT NULL,
  `tags` varchar(200) NOT NULL,
  `species` varchar(60) DEFAULT NULL,
  `age` varchar(60) DEFAULT NULL,
  `health` varchar(60) DEFAULT NULL,
  `size` varchar(60) DEFAULT NULL,
  `gender` varchar(60) DEFAULT NULL,
  `care_advice` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `category_id` int DEFAULT NULL,
  `cover_url` varchar(500) DEFAULT NULL,
  `detail_images_json` text NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `ix_products_name` (`name`),
  KEY `ix_products_category` (`category`),
  KEY `ix_products_is_active` (`is_active`),
  KEY `ix_products_category_id` (`category_id`),
  CONSTRAINT `fk_products_category_id` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'巴西龟（幼龟）','爬宠','活泼好养 · 新手推荐',39.00,49.00,523,86,'turtle','热卖','活泼好养,新手优选,健康保证','巴西龟（Trachemys scripta）','幼龟（3-6个月）','健康活泼','3-5cm','随机发货','水深2-3cm / 水温24-28℃ / 晒龟粮+虾干，每2-3天换水一次',1,2,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(2,'草龟（幼龟）','爬宠','耐养皮实 · 健康活泼',59.00,69.00,8432,52,'turtle-dark','人气','耐养皮实,健康活泼','中华草龟','幼龟（4-8个月）','健康活泼','4-6cm','随机发货','浅水饲养并设置晒台，保持水质清洁',1,2,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(3,'荷兰垂耳兔','爬宠','温顺亲人 · 疫苗已打',199.00,239.00,4567,18,'rabbit','新品','温顺亲人,疫苗已打','荷兰垂耳兔','幼年（2-3个月）','疫苗已完成','小型','可选','每日提供干草和清洁饮水，保持笼舍干燥',1,2,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(4,'侏儒兔','爬宠','迷你可爱 · 容易饲养',169.00,199.00,7120,23,'rabbit-brown','热卖','迷你可爱,容易饲养','侏儒兔','幼年（2-3个月）','健康活泼','迷你型','可选','避免高温，定时喂食提摩西草',1,2,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(5,'乌龟粮 250g','用品','营养均衡 · 助消化',19.90,29.90,26000,320,'food','热卖','营养均衡,助消化',NULL,NULL,NULL,'250g',NULL,'密封存放，每日按体重适量投喂',1,3,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(6,'龟缸套装（中号）','套餐','造景美观 · 全套齐全',129.00,159.00,2863,45,'tank','新品','造景美观,全套齐全',NULL,NULL,NULL,'中号',NULL,'包含过滤、晒台、加热灯与基础造景',1,1,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(7,'联调测试商品','用品','Element Plus 与 FastAPI CRUD 联调记录',12.80,15.80,0,21,'food','联调','CRUD,MySQL',NULL,NULL,NULL,'测试规格',NULL,'本地联调测试数据',0,3,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(8,'后台 UI 联调商品','用品','Element Plus 表单写入 FastAPI 与 MySQL',18.80,NULL,0,31,'food',NULL,'UI联调,MySQL',NULL,NULL,NULL,NULL,NULL,'可用于管理后台增改查测试',1,3,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56'),(9,'小乌龟','爬宠','小乌龟小乌龟小乌龟小乌龟',19.90,100.00,0,10,'爬宠',NULL,'',NULL,NULL,NULL,NULL,NULL,'小乌龟小乌龟',1,2,NULL,'[]',1,'2026-08-20 15:15:54','2026-08-20 15:15:56');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_coupons`
--

DROP TABLE IF EXISTS `user_coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_coupons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coupon_id` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'AVAILABLE',
  `order_id` int DEFAULT NULL,
  `received_at` datetime NOT NULL DEFAULT (now()),
  `used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_user_coupons_user_id` (`user_id`),
  KEY `ix_user_coupons_coupon_id` (`coupon_id`),
  KEY `ix_user_coupons_order_id` (`order_id`),
  KEY `ix_user_coupons_status` (`status`),
  CONSTRAINT `user_coupons_ibfk_1` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`),
  CONSTRAINT `user_coupons_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `user_coupons_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_coupons`
--

LOCK TABLES `user_coupons` WRITE;
/*!40000 ALTER TABLE `user_coupons` DISABLE KEYS */;
INSERT INTO `user_coupons` VALUES (1,1,1,'AVAILABLE',NULL,'2026-08-20 15:16:56',NULL);
/*!40000 ALTER TABLE `user_coupons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nickname` varchar(60) NOT NULL,
  `level` int NOT NULL,
  `points` int NOT NULL,
  `coupons` int NOT NULL,
  `favorites` int NOT NULL,
  `username` varchar(60) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'USER',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `wechat_openid` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_users_username` (`username`),
  UNIQUE KEY `uq_users_wechat_openid` (`wechat_openid`),
  KEY `ix_users_role` (`role`),
  KEY `ix_users_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'萌宠小主人',6,1260,3,8,'user','$argon2id$v=19$m=65536,t=3,p=4$4qwQcUOGHpRohF/NIJNIpw$C0eiSw1akSKTuzYFphOU+LN8XsLif2ibTgtqJ5pbtxg','USER',1,NULL,'2026-08-20 15:16:05','2026-08-20 15:16:56'),(2,'本地管理员',1,0,0,0,'admin','$argon2id$v=19$m=65536,t=3,p=4$5uaLpZtc34GuhAPR0IC8pQ$uIgbJLVBUT8wHyqt2fjFB8AQ6O4TOgHBrH/6+lVOmLs','ADMIN',1,NULL,'2026-08-20 15:16:56','2026-08-20 15:16:56');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'pet_life_dev'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-22 18:23:45
