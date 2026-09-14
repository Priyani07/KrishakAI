-- Migration: Add solution column to community_complaints
ALTER TABLE `community_complaints` ADD `solution` text;
