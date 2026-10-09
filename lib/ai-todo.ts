import type { Task } from "@/lib/model";

export type SuggestedTodo = {
  title: string;
  notes: string;
  area: Task["area"];
  priority: Task["priority"];
  due_date: string | null;
  due_time: string | null;
  needs_date: boolean;
  date_hint: string;
  needs_time: boolean;
  time_hint: string;
  recurrence: Task["recurrence"];
  subtasks: string[];
};

export function isValidLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthPattern = months.join("|");

export function explicitSingleDate(request: string, today: string): string | null {
  const monthFirst = new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i").exec(request);
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${monthPattern})(?:,?\\s+(\\d{4}))?\\b`, "i").exec(request);
  const month = monthFirst ? months.indexOf(monthFirst[1].toLowerCase()) + 1 : dayFirst ? months.indexOf(dayFirst[2].toLowerCase()) + 1 : 0;
  const day = Number(monthFirst?.[2] ?? dayFirst?.[1]);
  const explicitYear = monthFirst?.[3] ?? dayFirst?.[3];
  if (!month || !day) return null;
  let year = explicitYear ? Number(explicitYear) : Number(today.slice(0, 4));
  let result = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!isValidLocalDate(result)) return null;
  if (!explicitYear && result < today) {
    year++;
    result = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isValidLocalDate(result)) return null;
  }
  return result;
}

export function currentMonthDay(request: string, today: string): string | null {
  if (/\b(?:next|following|last|previous)\s+month\b/i.test(request)) return null;
  const match = /\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b|\bon\s+(?:the\s+)?(\d{1,2})\b/i.exec(request);
  const day = Number(match?.[1] ?? match?.[2]);
  if (!day) return null;
  const date = `${today.slice(0, 7)}-${String(day).padStart(2, "0")}`;
  return isValidLocalDate(date) ? date : null;
}

export function statedClockTime(request: string): string | null {
  const match = /\b(?:at|@)\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)?\b/i.exec(request)
    ?? /\b(\d{1,2}):([0-5]\d)\s*(a\.?m\.?|p\.?m\.?)?\s*(?:EST|EDT|Eastern)\b/i.exec(request);
  if (!match) return null;
  let hour = Number(match[1]);
  if (hour > 23) return null;
  const minute = Number(match[2] ?? "0");
  const suffix = match[3]?.toLowerCase().replaceAll(".", "");
  if (suffix && (hour < 1 || hour > 12)) return null;
  if (suffix === "pm" || (!suffix && hour <= 12 && /\b(evening|tonight|night|afternoon)\b/i.test(request))) hour = hour % 12 + 12;
  else if (suffix === "am" || (!suffix && hour <= 12 && /\bmorning\b/i.test(request))) hour %= 12;
  // Without a qualifier, 1–11 means morning; 12 means noon.
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function mentionsEasternTime(request: string) {
  return /\b(?:EST|EDT|Eastern(?:\s+Time)?)\b/i.test(request);
}

export function localDateTimeAtInstant(instant: string, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function alignSingleTodoSchedule(todo: SuggestedTodo, request: string, timezone: string, now = new Date().toISOString()): SuggestedTodo {
  const result = { ...todo };
  const sourceTimezone = mentionsEasternTime(request) ? "America/New_York" : timezone;
  const today = localDateTimeAtInstant(now, sourceTimezone).date;
  const statedDate = explicitSingleDate(request, today) ?? currentMonthDay(request, today);
  const statedTime = statedClockTime(request);
  if (statedDate) { result.due_date = statedDate; result.needs_date = false; result.date_hint = ""; }
  else if (result.needs_date) result.due_date = null;
  if (statedTime) { result.due_time = statedTime; result.needs_time = false; result.time_hint = ""; }
  else if (result.needs_time) result.due_time = null;
  if (statedDate && statedTime && sourceTimezone !== timezone) {
    const instant = zonedDateTimeToUtc(statedDate, statedTime, sourceTimezone);
    if (instant) {
      const local = localDateTimeAtInstant(instant, timezone);
      result.due_date = local.date;
      result.due_time = local.time;
    } else {
      result.due_time = null;
      result.needs_time = true;
      result.time_hint = `${statedTime} Eastern on that date`;
    }
  }
  return result;
}

export function zonedDateTimeToUtc(date: string, time: string, timezone: string): string | null {
  if (!isValidLocalDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return null; }
  for (let offset = 14 * 60; offset >= -12 * 60; offset -= 15) {
    const candidate = naive - offset * 60000;
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(part => [part.type, part.value]));
    if (Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day && Number(parts.hour) === hour && Number(parts.minute) === minute)
      return new Date(candidate).toISOString();
  }
  return null;
}

export function recentTaskStyle(tasks: Task[], timezone: string) {
  return [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12).map(task => {
    const due = task.due_date && task.due_time ? zonedDateTimeToUtc(task.due_date, task.due_time.slice(0, 5), timezone) : null;
    const lead = due && task.reminder_at ? Math.round((Date.parse(due) - Date.parse(task.reminder_at)) / 60000) : null;
    return {
      title: task.title.slice(0, 100), area: task.area, priority: task.priority,
      reminder_minutes_before: lead !== null && lead >= 0 && lead <= 10080 ? lead : null,
    };
  });
}

export function preferredReminderLead(tasks: Task[], timezone: string) {
  const counts = new Map<number, number>();
  for (const task of recentTaskStyle(tasks, timezone)) {
    if (task.reminder_minutes_before === null) continue;
    const lead = task.reminder_minutes_before;
    counts.set(lead, (counts.get(lead) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 15;
}
