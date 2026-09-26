CREATE TABLE `claude_context_windows` (
	`model` text PRIMARY KEY NOT NULL,
	`context_window` integer NOT NULL,
	`observed_at` integer NOT NULL
);
