export const AREAS = ["Work & career", "Health & wellbeing", "Personal growth", "Life admin"] as const;
export const AREA_COLORS = ["sage", "peach", "lavender", "blue"];
export type Subtask = {id:string;title:string;done:boolean};
export type Task = {id:string;title:string;notes:string;area:string;priority:"high"|"medium"|"low";status:"todo"|"in_progress"|"done";due_date:string|null;due_time:string|null;my_day:boolean;recurrence:"none"|"daily"|"weekly"|"monthly";goal_id:string|null;subtasks:Subtask[];reminder_at:string|null;created_at:string;completed_at:string|null};
export type Goal = {id:string;title:string;notes:string;area:string;target_date:string|null;target:number;current:number;unit:string;created_at:string};
export type Notice = {id:string;title:string;body:string;read_at:string|null;email_state:string;created_at:string;task_id:string|null};
export type Settings = {display_name:string;email:string;timezone:string;email_reminders:boolean;daily_digest:boolean;digest_hour:number;quiet_start:number;quiet_end:number;focus_minutes:number};
export type Focus = {id:string;minutes:number;completed_at:string};
export type WorkspaceData = {tasks:Task[];goals:Goal[];notifications:Notice[];focus:Focus[];settings:Settings;smtp_ready:boolean};
export function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
export function shiftDate(date:string,days:number){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return dateKey(d);}
export function progress(goal:Goal){return Math.min(100,Math.round(goal.current/goal.target*100));}
export function isOverdue(task:Task,today=dateKey()){return task.status!=="done"&&!!task.due_date&&task.due_date<today;}
export function areaColor(area:string){return AREA_COLORS[Math.max(0,AREAS.indexOf(area as typeof AREAS[number]))];}
export function prettyDate(date:string|null,today=dateKey()){if(!date)return "No date";if(date===today)return "Today";if(date===shiftDate(today,1))return "Tomorrow";return new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"});}
export const defaultSettings:Settings={display_name:"",email:"",timezone:"America/New_York",email_reminders:false,daily_digest:false,digest_hour:8,quiet_start:22,quiet_end:7,focus_minutes:25};
