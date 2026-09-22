CREATE TABLE `workflow_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`number` integer NOT NULL,
	`rendered_prompt` text NOT NULL,
	`result` text,
	`failure` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`step_id`) REFERENCES `workflow_steps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`graph` text NOT NULL,
	`inputs` text NOT NULL,
	`workspace` text NOT NULL,
	`machine_id` text NOT NULL,
	`supervisor_instance_id` text,
	`status` text NOT NULL,
	`result` text,
	`failure` text,
	`runtime` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`rerun_of_run_id` text,
	`launched_by` text NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`instance_id` text,
	`result` text,
	`failure` text,
	`map_index` integer,
	`started_at` integer,
	`ended_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`graph` text NOT NULL,
	`source` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflows_slug_unique` ON `workflows` (`slug`);--> statement-breakpoint
ALTER TABLE `instances` ADD `workflow_run_id` text;--> statement-breakpoint
ALTER TABLE `instances` ADD `workflow_step_id` text;