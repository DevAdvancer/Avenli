import assert from "node:assert/strict";
import test from "node:test";
import { friendlyWorkspaceError } from "../lib/workspace-error.ts";

test("reminder validation errors become a clear action", () => {
  const notice = friendlyWorkspaceError("task.save", "reminder_at: Invalid datetime", 400);
  assert.equal(notice.title, "Reminder could not be saved");
  assert.match(notice.description, /date and time/);
  assert.doesNotMatch(JSON.stringify(notice), /reminder_at|datetime/i);
});

test("other validation errors do not leak field names", () => {
  const notice = friendlyWorkspaceError("task.save", "subtasks.0.id: Invalid uuid", 400);
  assert.equal(notice.title, "Check the details and try again");
});

test("already readable errors stay readable", () => {
  assert.equal(friendlyWorkspaceError("task.delete", "This item no longer exists.", 404).title, "This item no longer exists.");
});
