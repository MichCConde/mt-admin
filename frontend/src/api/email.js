import { apiFetch } from "./internal";

export const sendDailyEmail = (date) =>
  apiFetch(`/api/email/send-report/${date}`, { method: "POST" });

export const sendMorningReport = () =>
  apiFetch("/api/email/send-morning-report", { method: "POST" });

export const sendEOWEmail = (start, end) =>
  apiFetch(`/api/email/send-eow-report?start=${start}&end=${end}`, { method: "POST" });