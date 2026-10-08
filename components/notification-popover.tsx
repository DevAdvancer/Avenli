"use client";

import { Bell, CheckCheck, ArrowUpRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Notice } from "@/lib/model";

type Props = {
  notices: Notice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onReadAll: () => void;
  onOpenTask: (id: string) => void;
  taskIds: Set<string>;
};

function emailStatus(state: string) {
  return state === "sent" ? "Email on its way" : state === "pending" ? "Email scheduled" : state === "failed" ? "Check your inbox" : state === "processing" ? "Sending email" : "Reminder";
}

export default function NotificationPopover({ notices, open, onOpenChange, busy, onReadAll, onOpenTask, taskIds }: Props) {
  const unread = notices.filter(n => !n.read_at).length;
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <button className="icon-button notification-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell size={19} />
        {unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={12} collisionPadding={12} className="notification-popover" aria-labelledby="notification-title">
      <header className="notification-header">
        <div><h2 id="notification-title">Notifications</h2><p aria-live="polite">{unread ? `${unread} unread` : "You’re all caught up"}</p></div>
        <button className="icon-button" aria-label="Close notifications" onClick={() => onOpenChange(false)}><X size={16} /></button>
      </header>
      <div className="notification-list">
        {notices.length ? <ul>{notices.map(n => <li className={`notification-item${n.read_at ? "" : " unread"}`} key={n.id}>
          <div className="notification-item-heading"><h3>{n.title==="Email test requested"?"Sample reminder":n.title}</h3>{!n.read_at && <span className="unread-indicator" aria-label="Unread" />}</div>
          <p>{n.title==="Email test requested"?"You requested a sample reminder. Check your inbox to see it.":n.body}</p>
          <div className="notification-meta"><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time><span>{emailStatus(n.email_state)}</span></div>
          {n.task_id && taskIds.has(n.task_id) && <button className="notification-task" onClick={() => { onOpenChange(false); onOpenTask(n.task_id!); }}>View task<ArrowUpRight size={13} /></button>}
        </li>)}</ul> : <div className="notification-empty"><Bell size={25} /><h3>All quiet, for now</h3><p>Your task reminders will appear here.</p></div>}
      </div>
      <footer className="notification-footer"><button disabled={!unread || busy} onClick={onReadAll}><CheckCheck size={15} />Mark all as read</button><span>Latest {notices.length} reminders</span></footer>
    </PopoverContent>
  </Popover>;
}
