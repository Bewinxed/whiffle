import { spawn } from "node:child_process";

/** Commands run on the workspace's machine; output stays bounded while pipes drain. */
export function runWorkflowCommand(
  cwd: unknown,
  cmd: unknown
): Promise<{ exitCode: number; output: string }> {
  if (
    typeof cwd !== "string" ||
    !cwd.startsWith("/") ||
    typeof cmd !== "string" ||
    !cmd.trim()
  ) {
    return Promise.reject(
      new Error(
        "runCommand requires an absolute workspace directory and a command."
      )
    );
  }
  return new Promise((resolve, reject) => {
    const child = spawn("/bin/sh", ["-c", cmd], {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = Buffer.alloc(0);
    let expired = false;
    const read = (chunk: Buffer) => {
      output = Buffer.concat([output, chunk]).subarray(-4096);
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    const timer = setTimeout(() => {
      expired = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          reject(error);
        }
      }
    }, 300_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: expired ? 124 : (code ?? 1),
        output: output.toString("utf8"),
      });
    });
  });
}
