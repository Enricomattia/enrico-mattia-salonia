import { reminderStore, sendDueReminders } from "../lib/papa-reminders.mjs";

export const config = { schedule: "* * * * *" };

export default async function handler(_request, context) {
  await sendDueReminders(reminderStore(context));
}
