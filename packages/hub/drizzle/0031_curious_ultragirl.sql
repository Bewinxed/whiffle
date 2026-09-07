CREATE TABLE `usage_limit_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machine_id` text NOT NULL,
	`kind` text NOT NULL,
	`scope_label` text,
	`percent` integer NOT NULL,
	`severity` text NOT NULL,
	`resets_at` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_limit_history_series_idx` ON `usage_limit_history` (`machine_id`,`kind`,`fetched_at`);--> statement-breakpoint
CREATE INDEX `usage_limit_history_fetched_idx` ON `usage_limit_history` (`fetched_at`);