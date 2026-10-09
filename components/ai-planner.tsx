"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { newTask } from "@/components/editors";
import { type Task } from "@/lib/model";
import { isValidLocalDate, preferredReminderLead, recentTaskStyle, type SuggestedTodo, zonedDateTimeToUtc } from "@/lib/ai-todo";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Turn = Pick<Message, "role" | "content">;
const message = (role: Message["role"], content: string): Message => ({ id: crypto.randomUUID(), role, content });

export function AiPlanner({ active, tasks, timezone, onSave }: {
  active: boolean;
  tasks: Task[];
  timezone: string;
  onSave: (task: Task) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [pending, setPending] = useState<SuggestedTodo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const locked = useRef(false);

  function say(role: Message["role"], content: string) {
    setChat(items => [...items, message(role, content)]);
    setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
  }

  async function saveTodos(items: SuggestedTodo[], withReminder: boolean) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    const lead = preferredReminderLead(tasks, timezone);
    let saved = 0;
    try {
      for (const item of items) {
        if (!item.title.trim() || item.due_date && !isValidLocalDate(item.due_date)) throw new Error("The AI returned an invalid todo. Please try describing it again.");
        const dueUtc = item.due_date && item.due_time ? zonedDateTimeToUtc(item.due_date, item.due_time, timezone) : null;
        if (item.due_date && item.due_time && !dueUtc) throw new Error(`The time for “${item.title}” does not exist in your timezone. Please give another time.`);
        const reminderAt = withReminder && dueUtc ? Date.parse(dueUtc) - lead * 60000 : null;
        if (reminderAt !== null && reminderAt <= Date.now()) throw new Error(`The reminder for “${item.title}” would be in the past. Please choose no reminder or give a later time.`);
        const task = newTask(false);
        task.title = item.title.trim(); task.notes = item.notes.trim(); task.area = item.area;
        task.priority = item.priority; task.due_date = item.due_date; task.due_time = item.due_time;
        task.recurrence = item.recurrence;
        task.my_day = item.due_date === new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        task.subtasks = item.subtasks.filter(Boolean).slice(0, 8).map(title => ({ id: crypto.randomUUID(), title, done: false }));
        task.reminder_at = reminderAt === null ? null : new Date(reminderAt).toISOString();
        if (!await onSave(task)) throw new Error("The remaining todos could not be saved. Please retry.");
        saved++;
        setPending(items.slice(saved));
      }
      setPending([]); setConversation([]);
      say("assistant", `Added ${saved} todo${saved === 1 ? "" : "s"}${withReminder ? " with a reminder" : ""}. What else would you like to plan?`);
      toast.success(`${saved} todo${saved === 1 ? "" : "s"} added`);
    } catch (cause) {
      setPending(items.slice(saved));
      setError(cause instanceof Error ? cause.message : "Couldn’t save the todos.");
      if (saved) say("assistant", `I added ${saved} todo${saved === 1 ? "" : "s"}. The rest are still waiting to retry.`);
    } finally { locked.current = false; setBusy(false); }
  }

  async function send() {
    const content = input.trim();
    if (!content || busy || locked.current) return;
    setInput(""); setError(""); say("user", content);
    if (pending.length) {
      if (/^(yes|yeah|yep|sure|please|remind me)$/i.test(content)) return void saveTodos(pending, true);
      if (/^(no|nope|not now|no reminder)$/i.test(content)) return void saveTodos(pending, false);
      if (/^cancel$/i.test(content)) { setPending([]); setConversation([]); say("assistant", "Okay, I didn’t add those. What would you like to plan?"); return; }
      say("assistant", "Would you like a reminder for these todos? Please say yes or no."); return;
    }
    const turns: Turn[] = [...conversation, { role: "user", content }];
    locked.current = true; setBusy(true);
    try {
      const response = await fetch("/api/ai/todos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: turns, timezone, history: recentTaskStyle(tasks, timezone) }),
      });
      const body = await response.json() as { question?: string | null; todos?: SuggestedTodo[]; error?: string };
      if (!response.ok) throw new Error(body.error || "I couldn’t plan that yet.");
      if (body.question) { setConversation([...turns, { role: "assistant", content: body.question }]); say("assistant", body.question); return; }
      if (!body.todos?.length) throw new Error("I couldn’t find a todo in that request. Please rephrase it.");
      setConversation([]);
      const summary = body.todos.map(todo => `• ${todo.title}${todo.due_date ? ` — ${todo.due_date}${todo.due_time ? ` at ${todo.due_time}` : ""}` : ""}`).join("\n");
      const scheduled = body.todos.some(todo => todo.due_date && todo.due_time);
      if (scheduled) {
        setPending(body.todos);
        say("assistant", `I’ve got ${body.todos.length === 1 ? "this todo" : "these todos"}:\n${summary}\nWould you like a reminder?`);
      } else {
        say("assistant", `I’ll add ${body.todos.length === 1 ? "this todo" : "these todos"}:\n${summary}`);
        locked.current = false; setBusy(false);
        await saveTodos(body.todos, false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "I couldn’t plan that yet.");
      setInput(content);
    } finally { locked.current = false; setBusy(false); }
  }

  const reminderLead = preferredReminderLead(tasks, timezone);
  return <section className="ai-planner-page" hidden={!active} aria-label="Plan with AI conversation">
    <div className="ai-planner-body">
      <div className="ai-chat" role="log" aria-live="polite">
        {!chat.length && <div className="ai-chat-intro"><Sparkles size={20}/><p>Try “On the 12th at 9, I have a dentist appointment.”</p><span>Times follow your workspace timezone unless you say Eastern.</span></div>}
        {chat.map(item => <div key={item.id} className={`ai-message ai-message-${item.role}`}>{item.content}</div>)}
        {busy && <div className="ai-message ai-message-assistant">Working on that…</div>}
        <div ref={chatEnd}/>
      </div>
      {pending.length > 0 && <div className="ai-reminder-actions"><Button type="button" className="primary-button" disabled={busy} onClick={() => { say("user", "Yes, remind me"); void saveTodos(pending, true); }}>Yes, remind me {reminderLead ? `${reminderLead} min before` : "at the time"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { say("user", "No reminder"); void saveTodos(pending, false); }}>No reminder</Button></div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <form className="ai-chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}><Textarea aria-label="Message Avenli" value={input} rows={2} maxLength={1500} placeholder={pending.length ? "Say yes or no…" : conversation.length ? "Answer Avenli’s question…" : "Tell Avenli what you need to do…"} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} disabled={busy}/><Button type="submit" className="primary-button" aria-label="Send message" disabled={busy || !input.trim()}><Send size={16}/></Button></form>
    </div>
  </section>;
}
