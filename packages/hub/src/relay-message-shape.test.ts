import { expect, test } from "bun:test";
import { normalizeRelayMessage } from "./server";

/**
 * The regression these cover: a relay send whose `message` was bare text used
 * to be forwarded verbatim, reach the CLI as a JSON string where an envelope
 * belongs, and be dropped there without a word — leaving the session at
 * `running` forever with no transcript and no error anywhere. Either it is
 * normalized here, or the caller is told; it is never passed on to hang.
 */

test("bare text is wrapped into a user envelope, in place", () => {
  const body: { instanceId: string; message: unknown } = {
    instanceId: "i-1",
    message: "Reply with exactly: OK",
  };
  expect(normalizeRelayMessage(body)).toBeUndefined();
  expect(body.message).toEqual({
    type: "user",
    message: { role: "user", content: "Reply with exactly: OK" },
  });
});

test("a well-formed envelope is left exactly as it was", () => {
  const message = {
    type: "user",
    message: { role: "user", content: "hello" },
    shouldQuery: false,
  };
  const body = { instanceId: "i-1", message };
  expect(normalizeRelayMessage(body)).toBeUndefined();
  // shouldQuery must survive: `isQuerySend` keys off it.
  expect(body.message).toEqual({
    type: "user",
    message: { role: "user", content: "hello" },
    shouldQuery: false,
  });
});

test("an envelope that only omitted `type` is completed", () => {
  const body = {
    instanceId: "i-1",
    message: { message: { role: "user", content: "hi" } },
  };
  expect(normalizeRelayMessage(body)).toBeUndefined();
  expect((body.message as { type?: unknown }).type).toBe("user");
});

test("a content block array is accepted", () => {
  const body = {
    instanceId: "i-1",
    message: {
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "hi" }] },
    },
  };
  expect(normalizeRelayMessage(body)).toBeUndefined();
});

test("a missing message is refused rather than forwarded", () => {
  expect(normalizeRelayMessage({ instanceId: "i-1" })).toContain(
    "relay send needs a message"
  );
});

test("a non-user role is refused", () => {
  const body = {
    instanceId: "i-1",
    message: { type: "user", message: { role: "assistant", content: "hi" } },
  };
  expect(normalizeRelayMessage(body)).toContain("role must be 'user'");
});

test("a non-text content is refused", () => {
  const body = {
    instanceId: "i-1",
    message: { type: "user", message: { role: "user", content: 42 } },
  };
  expect(normalizeRelayMessage(body)).toContain("content must be");
});

test("a non-user envelope type is refused", () => {
  const body = {
    instanceId: "i-1",
    message: { type: "assistant", message: { role: "user", content: "hi" } },
  };
  expect(normalizeRelayMessage(body)).toContain("message.type must be 'user'");
});
