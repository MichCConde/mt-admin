import { useState } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../../firebase";
import { colors, font, radius } from "../../styles/tokens";
import { Shield, Mail, User, Lock, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Card, PageHeader } from "../ui/Structure";
import { StatusBox } from "../ui/Indicators";
import Button from "../ui/Button";
import { getRoleLabel, getRoleConfig } from "../../utils/roles";

export default function Settings({ staff }) {
  const role      = staff?.role || "sme";
  const roleLabel = getRoleLabel(role);
  const config    = getRoleConfig(role);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [status,   setStatus]   = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleChangePassword(e) {
    e.preventDefault();
    setStatus("idle"); setErrorMsg("");

    if (!currentPw || !newPw || !confirmPw) {
      setStatus("error"); setErrorMsg("All fields are required.");
      return;
    }
    if (newPw.length < 8) {
      setStatus("error"); setErrorMsg("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setStatus("error"); setErrorMsg("New passwords do not match.");
      return;
    }
    if (currentPw === newPw) {
      setStatus("error"); setErrorMsg("New password must be different from current password.");
      return;
    }

    setStatus("loading");
    try {
      const user = auth.currentUser;
      // Re-authenticate first (required by Firebase for password changes)
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);

      setStatus("success");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setStatus("error");
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrorMsg("Current password is incorrect.");
      } else if (err.code === "auth/weak-password") {
        setErrorMsg("Password is too weak. Use at least 8 characters with a mix of letters and numbers.");
      } else if (err.code === "auth/requires-recent-login") {
        setErrorMsg("Session expired. Please sign out and sign back in, then try again.");
      } else {
        setErrorMsg("Failed to change password. Please try again.");
      }
    }
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", boxSizing: "border-box",
    border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
    fontSize: font.base, fontFamily: font.family, outline: "none",
    color: colors.textPrimary, background: colors.surface,
    transition: "border-color .12s",
  };
  const labelStyle = {
    display: "block", fontSize: font.sm, fontWeight: 700,
    color: colors.textBody, marginBottom: 6,
  };

  // Permission page labels for display
  const PAGE_LABELS = {
    dashboard: "Dashboard",
    virtual_assistants: "Virtual Assistants",
    schedule: "Schedule",
    eow_reports: "EOW Reports",
    eom_reports: "EOM Reports",
    activity_logs: "Activity Logs",
  };

  return (
    <div style={{ fontFamily: font.family, width: "100%", maxWidth: 640 }}>
      <PageHeader
        title="Settings"
        subtitle="Your account information and preferences."
      />

      {/* ── Profile Card ──────────────────────────────────────── */}
      <Card title="Profile" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { icon: User,   label: "Name",  value: staff?.name || "—" },
            { icon: Mail,   label: "Email", value: staff?.email || auth.currentUser?.email || "—" },
            { icon: Shield, label: "Role",  value: roleLabel },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: radius.md,
                background: colors.tealLight, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={16} color={colors.teal} />
              </div>
              <div>
                <div style={{ fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </div>
                <div style={{ fontSize: font.base, fontWeight: 600, color: colors.textPrimary, marginTop: 2 }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Permissions Card ──────────────────────────────────── */}
      <Card title="Permissions" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: font.sm, color: colors.textMuted, marginBottom: 12 }}>
          Your role ({roleLabel}) gives you access to the following pages:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {config.pages.map(pageId => (
            <span key={pageId} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: font.xs, fontWeight: 700,
              color: colors.teal, background: colors.tealLight,
              border: `1px solid ${colors.tealMid}`,
              borderRadius: radius.sm, padding: "4px 10px",
            }}>
              <CheckCircle2 size={10} />
              {PAGE_LABELS[pageId] || pageId}
            </span>
          ))}
        </div>
        {role !== "admin" && (
          <div style={{ fontSize: font.xs, color: colors.textFaint, marginTop: 12 }}>
            Contact your administrator to request additional access.
          </div>
        )}
      </Card>

      {/* ── Change Password Card ──────────────────────────────── */}
      <Card title="Change Password">
        {status === "success" && (
          <StatusBox variant="success" style={{ marginBottom: 16 }}>
            Password changed successfully.
          </StatusBox>
        )}
        {status === "error" && errorMsg && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
            background: colors.dangerLight, border: `1px solid ${colors.dangerBorder}`,
            borderRadius: radius.md, padding: "10px 14px",
          }}>
            <AlertTriangle size={14} color={colors.danger} />
            <span style={{ fontSize: font.sm, color: colors.danger }}>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Current Password */}
          <div>
            <label style={labelStyle}>Current Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                style={{ ...inputStyle, paddingRight: 40 }}
                onFocus={e => e.target.style.borderColor = colors.teal}
                onBlur={e => e.target.style.borderColor = colors.border}
              />
              <button
                type="button" onClick={() => setShowCurrent(!showCurrent)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                }}
              >
                {showCurrent ? <EyeOff size={16} color={colors.textFaint} /> : <Eye size={16} color={colors.textFaint} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label style={labelStyle}>New Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                style={{ ...inputStyle, paddingRight: 40 }}
                onFocus={e => e.target.style.borderColor = colors.teal}
                onBlur={e => e.target.style.borderColor = colors.border}
              />
              <button
                type="button" onClick={() => setShowNew(!showNew)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                }}
              >
                {showNew ? <EyeOff size={16} color={colors.textFaint} /> : <Eye size={16} color={colors.textFaint} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = colors.teal}
              onBlur={e => e.target.style.borderColor = colors.border}
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={status === "loading"}
            icon={Lock}
            style={{ alignSelf: "flex-start" }}
          >
            {status === "loading" ? "Changing…" : "Change Password"}
          </Button>
        </div>
      </Card>
    </div>
  );
}