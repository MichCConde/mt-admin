import { apiFetch } from "./internal";

export const sendDailyEmail = (date) =>
  apiFetch(`/api/email/daily?date=${date}`, { method: "POST" });

export const sendEOWEmail = (year, week) =>
  apiFetch(`/api/email/eow?year=${year}&week=${week}`, { method: "POST" });

export const sendAlert = (payload) =>
  apiFetch("/api/email/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });