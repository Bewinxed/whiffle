CREATE TABLE `capability_usage_daily` (
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`day` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`kind`, `name`, `day`)
);
