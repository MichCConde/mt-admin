import { ClipboardList, Clock, BarChart3, ShieldAlert, CalendarDays, ArrowRight } from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { SectionLabel } from "../ui/Card";
import { SoonBadge } from "../ui/Badge";

const QUICK_ACTIONS = [
  {
    icon:   ClipboardList,
    title:  "EOD Reports",
    sub:    "Check who submitted their end-of-day report",
    tab:    "va_reports",
    accent: colors.teal,
    bg:     colors.tealLight,
  },
  {
    icon:   Clock,
    title:  "Attendance",
    sub:    "Review clock-in and clock-out records",
    tab:    "va_reports",
    accent: colors.communityMain,
    bg:     colors.infoLight,
  },
];

const COMING_SOON = [
  { icon: BarChart3,    label: "EOM Reports",      sub: "Monthly summaries per VA"      },
  { icon: ShieldAlert,  label: "Strike Tracker",    sub: "Monitor VA strike status"      },
  { icon: CalendarDays, label: "Schedule Overview", sub: "Shifts and working schedules"  },
];

export default function Dashboard({ setActiveTab }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
                "Good evening";

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: font.h1, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
          {greeting}
        </h1>
        <p style={{ fontSize: font.base, color: colors.textMuted, marginTop: 6, margin: "6px 0 0" }}>
          Here's what needs your attention today.
        </p>
      </div>

      {/* Quick Actions */}
      <SectionLabel>Quick Actions</SectionLabel>
      <div style={{
        display:               "grid",
        gridTemplateColumns:   "repeat(auto-fill, minmax(320px, 1fr))",
        gap:                   16,
        marginBottom:          48,
      }}>
        {QUICK_ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={i}
              onClick={() => setActiveTab(a.tab)}
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          18,
                padding:      "22px 24px",
                background:   colors.surface,
                border:       `1.5px solid ${colors.border}`,
                borderRadius: radius.lg,
                cursor:       "pointer",
                textAlign:    "left",
                fontFamily:   font.family,
                boxShadow:    shadow.card,
                transition:   "border-color .15s, box-shadow .15s, transform .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = a.accent;
                e.currentTarget.style.boxShadow   = shadow.md;
                e.currentTarget.style.transform   = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow   = shadow.card;
                e.currentTarget.style.transform   = "none";
              }}
            >
              <div style={{
                width:          48,
                height:         48,
                borderRadius:   radius.md,
                background:     a.bg,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                flexShrink:     0,
              }}>
                <Icon size={22} color={a.accent} strokeWidth={2} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: font.lg, fontWeight: 700, color: colors.textPrimary }}>
                  {a.title}
                </div>
                <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                  {a.sub}
                </div>
              </div>

              <ArrowRight size={16} color={colors.textFaint} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {/* Coming Soon */}
      <SectionLabel>Coming Soon</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {COMING_SOON.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} style={{
              display:      "flex",
              alignItems:   "center",
              gap:          16,
              padding:      "14px 20px",
              background:   colors.surface,
              border:       `1px dashed ${colors.border}`,
              borderRadius: radius.md,
            }}>
              <div style={{
                width:          36,
                height:         36,
                borderRadius:   radius.sm,
                background:     colors.bg,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                flexShrink:     0,
              }}>
                <Icon size={16} color={colors.textMuted} strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: font.base, fontWeight: 600, color: colors.textMuted }}>
                  {item.label}
                </div>
                <div style={{ fontSize: font.sm, color: colors.textFaint, marginTop: 2 }}>
                  {item.sub}
                </div>
              </div>
              <SoonBadge />
            </div>
          );
        })}
      </div>
    </div>
  );
}