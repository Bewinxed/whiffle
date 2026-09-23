/**
 * TypeSafe's Jev, reached through OpenRouter's System One endpoint.
 *
 * One POST answers every question at once against one shared `state`, each
 * with a calibrated yes-probability (a "noul"). Plain `fetch`, no SDK:
 * https://openrouter.ai/docs/guides/community/typesafe-sdk — "`jev-latest` is
 * routed as `~typesafe/jev-latest`".
 */

const SYSTEMONE_URL = "https://openrouter.ai/api/v1/systemone";
const JEV_TIMEOUT_MS = 10_000;

interface SystemOneResponse {
  answers: Record<string, { type: "noul"; noul: number }>;
  usage: { cost: number };
}

export async function askNouls(
  key: string,
  state: Record<string, string>,
  questions: Record<string, { instructions: string }>
): Promise<
  { answers: Record<string, number>; costUsd: number } | { error: string }
> {
  const body = {
    model: "jev-latest",
    state,
    questions: Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        { type: "noul", instructions: question.instructions },
      ])
    ),
  };
  try {
    const response = await fetch(SYSTEMONE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/bewinxed/whiffle",
        "X-OpenRouter-Title": "Whiffle",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { error: `${response.status} ${await response.text()}` };
    }
    const parsed = (await response.json()) as SystemOneResponse;
    return {
      answers: Object.fromEntries(
        Object.entries(parsed.answers).map(([id, answer]) => [id, answer.noul])
      ),
      costUsd: parsed.usage.cost,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
