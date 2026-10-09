import test from "node:test";
import assert from "node:assert/strict";
import { alignSingleTodoSchedule, zonedDateTimeToUtc } from "../lib/ai-todo.ts";

const base = {
  title: "Appointment", notes: "", area: "Health & wellbeing", priority: "medium",
  due_date: null, due_time: null, needs_date: true, date_hint: "the 12th",
  needs_time: true, time_hint: "at 9", recurrence: "none", subtasks: [],
};
const octoberNow = "2026-10-09T12:00:00.000Z";

test("a bare day and hour use the current month and morning", () => {
  const result = alignSingleTodoSchedule(base, "On the 12th at 9 I have an appointment", "America/New_York", octoberNow);
  assert.equal(result.due_date, "2026-10-12");
  assert.equal(result.due_time, "09:00");
  assert.equal(result.needs_date, false);
  assert.equal(result.needs_time, false);
});

test("evening turns 9 into 21:00", () => {
  const result = alignSingleTodoSchedule(base, "12th at 9 in the evening", "America/New_York", octoberNow);
  assert.equal(result.due_date, "2026-10-12");
  assert.equal(result.due_time, "21:00");
});

test("EST means Eastern wall time with the date's daylight-saving offset", () => {
  const october = alignSingleTodoSchedule(base, "12th at 9:00 EST", "America/New_York", octoberNow);
  assert.equal(october.due_time, "09:00");
  assert.equal(zonedDateTimeToUtc(october.due_date, october.due_time, "America/New_York"), "2026-10-12T13:00:00.000Z");
  const january = alignSingleTodoSchedule(base, "12th at 9:00 EST", "America/New_York", "2027-01-09T12:00:00.000Z");
  assert.equal(zonedDateTimeToUtc(january.due_date, january.due_time, "America/New_York"), "2027-01-12T14:00:00.000Z");
});

test("an explicit Eastern time is converted for another workspace timezone", () => {
  const result = alignSingleTodoSchedule(base, "12th at 9 EST", "Europe/London", octoberNow);
  assert.equal(result.due_date, "2026-10-12");
  assert.equal(result.due_time, "14:00");
});

test("an explicit month takes precedence over the current month", () => {
  const result = alignSingleTodoSchedule(base, "November 12 at 9", "America/New_York", octoberNow);
  assert.equal(result.due_date, "2026-11-12");
  assert.equal(result.due_time, "09:00");
});

test("a bare day stays in the current month even after it has passed", () => {
  const result = alignSingleTodoSchedule(base, "on the 12th at 9", "America/New_York", "2026-10-20T12:00:00.000Z");
  assert.equal(result.due_date, "2026-10-12");
});

test("an explicitly different relative month is left for the model to resolve", () => {
  const result = alignSingleTodoSchedule({ ...base, due_date: "2026-11-12", needs_date: false }, "on the 12th next month at 9", "America/New_York", octoberNow);
  assert.equal(result.due_date, "2026-11-12");
});
