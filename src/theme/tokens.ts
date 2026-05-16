/** Light SaaS palette — single source for UI consistency */
export const colors = {
  bg: {
    page: "#f1f5f9",
    surface: "#ffffff",
    muted: "#f8fafc",
  },
  border: {
    subtle: "#e2e8f0",
    default: "#cbd5e1",
  },
  text: {
    primary: "#0f172a",
    secondary: "#64748b",
    muted: "#94a3b8",
    inverse: "#ffffff",
  },
  accent: {
    DEFAULT: "#2563eb",
    hover: "#1d4ed8",
    soft: "#eff6ff",
    border: "#bfdbfe",
  },
  success: {
    DEFAULT: "#16a34a",
    soft: "#f0fdf4",
  },
  danger: {
    DEFAULT: "#dc2626",
    dark: "#b91c1c",
    soft: "#fef2f2",
  },
  warning: {
    soft: "#fffbeb",
    border: "#fde68a",
  },
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Card elevation (cross-platform) */
export const shadowCard = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

export const shadowHeader = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
};
