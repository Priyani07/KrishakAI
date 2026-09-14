CREATE TABLE `community_comments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`discussion_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`text` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_complaints` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`subject` varchar(200) NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`location` varchar(200) NOT NULL,
	`status` enum('submitted','in_review','resolved') NOT NULL DEFAULT 'submitted',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_complaints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_discussions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`problem_type` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_discussions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`jti` varchar(36) NOT NULL,
	`expires_at` datetime NOT NULL,
	`revoked_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `community_sessions_jti_unique` UNIQUE(`jti`)
);
--> statement-breakpoint
CREATE TABLE `community_users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`farm_name` varchar(160) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('farmer','admin') NOT NULL DEFAULT 'farmer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `community_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `community_comments` ADD CONSTRAINT `community_comments_discussion_id_community_discussions_id_fk` FOREIGN KEY (`discussion_id`) REFERENCES `community_discussions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_comments` ADD CONSTRAINT `community_comments_user_id_community_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `community_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `community_comments_discussion_created_idx` ON `community_comments` (`discussion_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `community_comments_user_idx` ON `community_comments` (`user_id`);