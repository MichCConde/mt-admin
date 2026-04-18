const ROLE_PERMISSIONS = {
  admin: {
    label: "Administrator",
    pages: ["dashboard", "virtual_assistants", "schedule", "eow_reports", "eom_reports", "activity_logs", "staff_management"],
    showComingSoon: true,
  },
  recruitment: {
    label: "Recruitment",
    pages: ["dashboard", "virtual_assistants", "schedule"],
    showComingSoon: false,
  },
  sme: {
    label: "SME",
    pages: ["dashboard", "virtual_assistants"],
    showComingSoon: false,
  },
};

const DEFAULT_ROLE = "sme";

export function getRoleConfig(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[DEFAULT_ROLE];
}

export function canAccessPage(role, pageId) {
  const config = getRoleConfig(role);
  return config.pages.includes(pageId);
}

export function getRoleLabel(role) {
  return getRoleConfig(role).label;
}

export function getAccessiblePages(role) {
  return getRoleConfig(role).pages;
}

export function showComingSoon(role) {
  return getRoleConfig(role).showComingSoon;
}