ALTER TABLE `community_comments` ADD `parent_comment_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `community_comments` ADD `parent_comment_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `community_comments` ADD `deleted_at` datetime;--> statement-breakpoint
ALTER TABLE `community_comments` ADD CONSTRAINT `community_comments_parent_comment_id_community_comments_id_fk` FOREIGN KEY (`parent_comment_id`) REFERENCES `community_comments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `community_comments_parent_created_idx` ON `community_comments` (`parent_comment_id`,`created_at`);
