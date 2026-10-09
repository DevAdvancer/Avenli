export type FriendlyWorkspaceError = { title: string; description?: string };

export function friendlyWorkspaceError(action: string, raw: string | undefined, status: number): FriendlyWorkspaceError {
  if (action === "smtp.test") return {
    title: "Sample reminder could not be sent",
    description: "Check your inbox and try again in a minute.",
  };
  if (status === 401) return { title: "Please sign in again", description: "Your session may have expired." };
  if (status === 403) return { title: "You cannot make this change", description: "Refresh the page and try again." };
  if (status >= 500) return { title: "Could not save your change", description: "Please try again in a moment." };
  if (/^reminder_at:/i.test(raw ?? "")) return {
    title: "Reminder could not be saved",
    description: "Check the reminder date and time, then try again. Your task was not changed.",
  };
  if (/^due_date:/i.test(raw ?? "")) return { title: "Check the due date", description: "Choose a valid date and try again." };
  if (/^due_time:/i.test(raw ?? "")) return { title: "Check the time", description: "Choose a valid time and try again." };
  if (/^title:/i.test(raw ?? "")) return { title: "Give this a name", description: "Add a short title and try again." };
  if (/^(?:[\w.\[\]]+:\s|Invalid |Required$|Expected )/i.test(raw ?? "")) return {
    title: "Check the details and try again",
    description: "One of the entries could not be saved.",
  };
  if (raw && !/^(?:Unauthorized|Unknown action)$/i.test(raw)) return { title: raw };
  return { title: "Could not save your change", description: "Please try again." };
}
