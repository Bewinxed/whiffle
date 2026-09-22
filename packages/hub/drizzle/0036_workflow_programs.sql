-- Workflows become programs (proposal §13). The executable form moves from the
-- graph interpreter to a stored TypeScript program plus an effect journal, so
-- the run tables are recreated rather than migrated: the only rows in flight
-- are throwaway verification runs.
DROP TABLE IF EXISTS `workflow_attempts`;--> statement-breakpoint
DROP TABLE IF EXISTS `workflow_steps`;--> statement-breakpoint
DROP TABLE IF EXISTS `workflow_runs`;--> statement-breakpoint
DROP TABLE IF EXISTS `workflows`;--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`graph` text,
	`program` text NOT NULL,
	`origin` text NOT NULL,
	`inputs` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `workflows_slug_unique` ON `workflows` (`slug`);--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`parent_run_id` text,
	`parent_step_id` text,
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`graph` text,
	`program` text NOT NULL,
	`inputs` text NOT NULL,
	`workspace` text NOT NULL,
	`machine_id` text NOT NULL,
	`supervisor_instance_id` text,
	`status` text NOT NULL,
	`result` text,
	`failure` text,
	`state` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`rerun_of_run_id` text,
	`launched_by` text NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`child_run_id` text,
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`seq` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`instance_id` text,
	`result` text,
	`failure` text,
	`map_index` integer,
	`started_at` integer,
	`ended_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `workflow_effects` (
	`run_id` text NOT NULL,
	`seq` integer NOT NULL,
	`kind` text NOT NULL,
	`args_hash` text NOT NULL,
	`result` text,
	`failure` text,
	`at` integer NOT NULL,
	PRIMARY KEY(`run_id`, `seq`),
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `workflow_effects_run` ON `workflow_effects` (`run_id`);--> statement-breakpoint
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
);--> statement-breakpoint
UPDATE `instances` SET `workflow_run_id` = NULL, `workflow_step_id` = NULL;
