import { useState }              from "react";
import { Search, Copy, Check, Clock, ClipboardList, Users, FileCheck, UserX, CheckCircle2, Timer, Mail } from "lucide-react";
import { colors, font }          from "../../styles/tokens";
import { apiFetch }              from "../../api";
import Button                           from "../ui/Button";
import { Card, SectionLabel, ControlBar, PageHeader, TabBar, StatRow } from "../ui/Structure";
import { DataTable }                    from "../ui/Tables";
import { DateInput }                    from "../ui/Inputs";
import { StatCard, StatusBox, CommunityBadge, StatusBadge } from "../ui/Indicators";

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

const fmtDateLong = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

const TABS = [
  { id: "eod",        Icon: ClipboardList, label: "EOD Reports" },
  { id: "attendance", Icon: Clock,         label: "Attendance"  },
];

// ── Root ──────────────────────────────────────────────────────────
export default function VAReports() {
  const [activeTab, setActiveTab] = useState("eod");
  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="VA Reports"
        subtitle="Monitor daily EOD submissions and attendance records."
      />
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "eod"        && <EODChecker />}
      {activeTab === "attendance" && <AttendanceChecker />}
    </div>
  );
}

// ── EOD Checker ───────────────────────────────────────────────────
function EODChecker() {
  const [date,     setDate]     = useState(yesterday());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [copied,   setCopied]   = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailOk,  setEmailOk]  = useState(false);

  async function runCheck() {
    setLoading(true); setError(""); setData(null);
    try   { setData(await apiFetch(`/api/eod?date=${date}`)); }
    catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  }

  async function sendEmail() {
    setEmailing(true); setEmailOk(false);
    try {
      await apiFetch(`/api/email/send-report/${date}`, { method: "POST" });
      setEmailOk(true);
      setTimeout(() => setEmailOk(false), 3000);
    } catch (e) {
      alert(`Email failed: ${e.message}`);
    } finally {
      setEmailing(false);
    }
  }

  function copyNotification() {
    if (!data?.missing?.length) return;
    const text = [
      `Hi team — EOD reminder for ${fmtDateLong(date)}:`,
      "",
      `The following VA${data.missing.length !== 1 ? "s have" : " has"} not yet submitted their EOD report:`,
      "",
      ...data.missing.map((va) => {
        const client = va.missing_client ? ` — Client: ${va.missing_client}` : "";
        return `- ${va.name} [${va.community ?? "?"}]${client}`;
      }),
      "",
      "Please submit as soon as possible. Thank you.",
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      <ControlBar>
        <DateInput value={date} onChange={setDate} label="Date" />
        <Button icon={Search} onClick={runCheck} disabled={loading} style={{ alignSelf: "flex-end", height: 38 }}>
          {loading ? "Loading…" : "Run Check"}
        </Button>
        {data && (
          <Button variant="secondary" icon={emailOk ? Check : Mail} onClick={sendEmail} disabled={emailing} style={{ alignSelf: "flex-end", height: 38 }}>
            {emailing ? "Sending…" : emailOk ? "Sent!" : "Email Report"}
          </Button>
        )}
      </ControlBar>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && (
        <>
          <StatRow>
            <StatCard icon={Users}     label="Active VAs"    value={data.active_va_count}  />
            <StatCard icon={Clock}     label="Clocked In"    value={data.clocked_in_count} />
            <StatCard icon={FileCheck} label="EOD Submitted" value={data.submitted_count}  />
            <StatCard
              icon={data.missing_count > 0 ? UserX : CheckCircle2}
              label="Missing"
              value={data.missing_count}
              highlight={data.missing_count > 0 ? "danger" : "success"}
            />
            <StatCard
              icon={Timer}
              label="Late Submissions"
              value={data.late_count}
              highlight={data.late_count > 0 ? "warning" : "success"}
            />
          </StatRow>

          {data.missing.length > 0 ? (
            <Card
              title={`${data.missing.length} Missing EOD Report${data.missing.length !== 1 ? "s" : ""}`}
              action={
                <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyNotification}>
                  {copied ? "Copied" : "Copy Notification"}
                </Button>
              }
              noPadding
            >
              {data.missing.map((va, i) => (
                <div key={i} style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         12,
                  padding:     "11px 20px",
                  borderTop:   i > 0 ? `1px solid ${colors.dangerBorder}` : "none",
                  background:  i % 2 === 0 ? colors.dangerLight : "#FFF8F8",
                }}>
                  <CommunityBadge community={va.community} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                      {va.name}
                    </span>
                    {va.missing_client && (
                      <span style={{ fontSize: font.sm, color: colors.textMuted, marginLeft: 8 }}>
                        Client: {va.missing_client}
                      </span>
                    )}
                  </div>
                  <StatusBadge variant={va.clocked_in ? "warning" : "neutral"}>
                    {va.clocked_in ? "Clocked in, no EOD" : "No clock-in or EOD"}
                  </StatusBadge>
                </div>
              ))}
            </Card>
          ) : (
            <StatusBox variant="success">All VAs submitted their EOD reports.</StatusBox>
          )}

          {data.late_submissions?.length > 0 && (
            <Card title={`Late Submissions (${data.late_submissions.length})`} noPadding>
              {data.late_submissions.map((r, i) => (
                <div key={i} style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         12,
                  padding:     "11px 20px",
                  borderTop:   i > 0 ? `1px solid ${colors.warningBorder}` : "none",
                  background:  i % 2 === 0 ? colors.warningLight : "#FFFDF0",
                }}>
                  <CommunityBadge community={r.community} />
                  <span style={{ fontWeight: 600, flex: 1, fontSize: font.base }}>{r.name}</span>
                  {r.client && <span style={{ fontSize: font.sm, color: colors.textMuted }}>{r.client}</span>}
                  <StatusBadge variant="warning">
                    {r.punctuality.submitted_est} — {r.punctuality.minutes_late}m late
                  </StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {data.eod_submissions.length > 0 && (
            <div>
              <SectionLabel>Submitted ({data.eod_submissions.length})</SectionLabel>
              <DataTable
                columns={[
                  { label: "Name",      flex: 2 },
                  { label: "Community", flex: 1 },
                  { label: "Client",    flex: 2 },
                  { label: "Submitted", flex: 1 },
                  { label: "Status",    flex: 1 },
                ]}
                rows={data.eod_submissions.map((r) => [
                  <span style={{ fontWeight: 600, color: colors.textPrimary }}>{r.name}</span>,
                  <CommunityBadge community={r.community} />,
                  <span style={{ color: colors.textMuted }}>{r.client || "—"}</span>,
                  <span style={{ color: colors.textMuted, fontSize: font.sm }}>{r.punctuality?.submitted_est ?? "—"}</span>,
                  r.punctuality?.on_time
                    ? <StatusBadge variant="success">On Time</StatusBadge>
                    : <StatusBadge variant="warning">{r.punctuality?.minutes_late}m Late</StatusBadge>,
                ])}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Attendance Checker ────────────────────────────────────────────
function AttendanceChecker() {
  const [date,    setDate]    = useState(yesterday());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function runCheck() {
    setLoading(true); setError(""); setData(null);
    try   { setData(await apiFetch(`/api/attendance?date=${date}`)); }
    catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      <ControlBar>
        <DateInput value={date} onChange={setDate} label="Date" />
        <Button icon={Search} onClick={runCheck} disabled={loading} style={{ alignSelf: "flex-end", height: 38 }}>
          {loading ? "Loading…" : "Run Check"}
        </Button>
      </ControlBar>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && (
        <>
          <StatRow>
            <StatCard icon={Users}        label="Active VAs"  value={data.vas.length}        />
            <StatCard icon={Clock}        label="Clocked In"  value={data.clock_ins.length}  />
            <StatCard icon={CheckCircle2} label="Clocked Out" value={data.clock_outs.length} />
            <StatCard
              icon={data.no_record.length > 0 ? UserX : CheckCircle2}
              label="No Record"
              value={data.no_record.length}
              highlight={data.no_record.length > 0 ? "danger" : "success"}
            />
            <StatCard
              icon={Timer}
              label="Late Clock-Ins"
              value={data.late_count}
              highlight={data.late_count > 0 ? "warning" : "success"}
            />
          </StatRow>

          {data.no_record.length > 0 ? (
            <Card title={`${data.no_record.length} VA${data.no_record.length !== 1 ? "s" : ""} with No Clock-In`} noPadding>
              {data.no_record.map((va, i) => (
                <div key={i} style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        12,
                  padding:    "11px 20px",
                  borderTop:  i > 0 ? `1px solid ${colors.dangerBorder}` : "none",
                  background: i % 2 === 0 ? colors.dangerLight : "#FFF8F8",
                }}>
                  <CommunityBadge community={va.community} />
                  <span style={{ fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    {va.name}
                  </span>
                </div>
              ))}
            </Card>
          ) : (
            <StatusBox variant="success">All active VAs have a clock-in record.</StatusBox>
          )}

          {data.late_clock_ins?.length > 0 && (
            <Card title={`Late Clock-Ins (${data.late_clock_ins.length})`} noPadding>
              {data.late_clock_ins.map((c, i) => (
                <div key={i} style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        12,
                  padding:    "11px 20px",
                  borderTop:  i > 0 ? `1px solid ${colors.warningBorder}` : "none",
                  background: i % 2 === 0 ? colors.warningLight : "#FFFDF0",
                }}>
                  <CommunityBadge community={c.community} />
                  <span style={{ fontWeight: 600, flex: 1, fontSize: font.base }}>{c.name}</span>
                  <StatusBadge variant="warning">{c.time_in} — late</StatusBadge>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}