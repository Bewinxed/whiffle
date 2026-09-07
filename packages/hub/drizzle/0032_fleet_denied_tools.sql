ALTER TABLE `supervisor_config` ADD `denied_tools` text;--> statement-breakpoint
UPDATE `supervisor_config` SET `denied_tools` = '["WebSearch","WebFetch","Task","Agent"]' WHERE `id` = 'supervisor';--> statement-breakpoint
INSERT OR IGNORE INTO `supervisor_config` (`id`, `enabled`, `denied_tools`, `updated_at`) VALUES ('supervisor', false, '["WebSearch","WebFetch","Task","Agent"]', unixepoch() * 1000);
