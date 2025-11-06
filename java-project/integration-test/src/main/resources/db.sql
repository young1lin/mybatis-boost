-- User table
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255),
    age INTEGER,
    create_time TIMESTAMP,
    update_time TIMESTAMP,
    version INTEGER DEFAULT 0
);

-- Role table
DROP TABLE IF EXISTS `role`;
CREATE TABLE `role` (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    `role_name` VARCHAR(255) UNIQUE NOT NULL,
    `remark` VARCHAR(255),
    create_time TIMESTAMP,
    update_time TIMESTAMP,
    version INTEGER DEFAULT 0
);

-- Permission table
DROP TABLE IF EXISTS permission;
CREATE TABLE permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    `permission_name` VARCHAR(255) UNIQUE NOT NULL,
    `resource` VARCHAR(255),
    `action` INTEGER,
    `type` INTEGER,
    `description` VARCHAR(500),
    `status` INTEGER DEFAULT 1,
    parent_id BIGINT,
    sort_order INTEGER,
    create_time TIMESTAMP,
    update_time TIMESTAMP,
    version INTEGER DEFAULT 0
);

DROP TABLE IF EXISTS `user_role`;
CREATE TABLE `user_role` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT,
    `role_id` BIGINT,
    create_time TIMESTAMP,
    update_time TIMESTAMP,
    version INTEGER DEFAULT 0
)
