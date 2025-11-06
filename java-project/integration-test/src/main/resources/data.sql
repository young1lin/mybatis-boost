-- Insert test data for User table
INSERT INTO `user` (`name`, age, create_time, update_time, version) VALUES
('Liam', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('Ivy', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('Bob', 28, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert test data for Role table
INSERT INTO `role` (`role_name`, `remark`, create_time, update_time, version) VALUES
('ADMIN', 'Administrator role', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('USER', 'User role', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('GUEST', 'Guest role', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert test data for Permission table
INSERT INTO permission (`permission_name`, `resource`, `action`, `type`, `description`, `status`, parent_id, sort_order, create_time, update_time, version) VALUES
('user:view', '/api/users', 1, 3, 'View user', 1, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('user:create', '/api/users', 2, 3, 'Create user', 1, NULL, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('user:edit', '/api/users', 2, 3, 'Edit user', 1, NULL, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('user:delete', '/api/users', 2, 3, 'Delete user', 1, NULL, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('role:view', '/api/roles', 1, 3, 'View role', 1, NULL, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('permission:view', '/api/permissions', 1, 3, 'View permission', 1, NULL, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

