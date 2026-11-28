import { manageReminders, reminderStore } from "../lib/papa-reminders.mjs";

export const config = {
  path: "/api/papa/reminders",
  method: ["GET", "PUT", "DELETE"],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] }
};

export default (request, context) => manageReminders(request, reminderStore(context));
