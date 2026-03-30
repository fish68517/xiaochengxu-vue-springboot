-- Merchant role + pickup code + fixed dining window migration
-- This script is designed to be idempotent.

-- 1) Extend user role enum
ALTER TABLE `user`
MODIFY COLUMN `role` ENUM('user','merchant','admin') DEFAULT 'user';

-- 2) Add recipe.merchant_id if missing
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe' AND COLUMN_NAME = 'merchant_id'
    ),
    'SELECT 1',
    'ALTER TABLE `recipe` ADD COLUMN `merchant_id` INT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Add recipe.window_id if missing
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe' AND COLUMN_NAME = 'window_id'
    ),
    'SELECT 1',
    'ALTER TABLE `recipe` ADD COLUMN `window_id` INT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) Add indexes if missing
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe' AND INDEX_NAME = 'idx_recipe_merchant_id'
    ),
    'SELECT 1',
    'ALTER TABLE `recipe` ADD INDEX `idx_recipe_merchant_id` (`merchant_id`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe' AND INDEX_NAME = 'idx_recipe_window_id'
    ),
    'SELECT 1',
    'ALTER TABLE `recipe` ADD INDEX `idx_recipe_window_id` (`window_id`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) Add merchant foreign key if missing
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_recipe_merchant'
    ),
    'SELECT 1',
    'ALTER TABLE `recipe` ADD CONSTRAINT `fk_recipe_merchant` FOREIGN KEY (`merchant_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6) Create dining_window table
CREATE TABLE IF NOT EXISTS `dining_window` (
  `id` INT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL,
  `status` TINYINT DEFAULT 1,
  `sort_order` INT DEFAULT 0
);

-- Initialize windows from existing category table
INSERT INTO `dining_window` (`id`, `name`, `status`, `sort_order`)
SELECT c.id, c.name, 1, c.id
FROM `category` c
WHERE NOT EXISTS (
  SELECT 1 FROM `dining_window` w WHERE w.id = c.id
);

-- Backfill recipe.window_id from category_id
UPDATE `recipe`
SET `window_id` = `category_id`
WHERE `window_id` IS NULL AND `category_id` IS NOT NULL;

-- 7) Add window foreign key if missing
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_recipe_window'
    ),
    'SELECT 1',
    'ALTER TABLE `recipe` ADD CONSTRAINT `fk_recipe_window` FOREIGN KEY (`window_id`) REFERENCES `dining_window`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8) Add order pickup_code if missing
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order' AND COLUMN_NAME = 'pickup_code'
    ),
    'SELECT 1',
    'ALTER TABLE `order` ADD COLUMN `pickup_code` VARCHAR(20) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9) Add order.remark if missing
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order' AND COLUMN_NAME = 'remark'
    ),
    'SELECT 1',
    'ALTER TABLE `order` ADD COLUMN `remark` VARCHAR(255) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;