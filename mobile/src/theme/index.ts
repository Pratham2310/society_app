// =======================================================
// THEME
//
// Taken from the app designs: a pale sage ground, warm off-white
// cards, and a terracotta action colour. Single light theme — the
// designs commit to one look, so a half-considered dark mode would
// be worse than none.
// =======================================================

export const colors = {
  ground: "#EAF1DC",
  surface: "#FDFBF7",
  surfaceAlt: "#F4F1E8",
  sunk: "#E1E9D0",

  ink: "#1C1A16",
  inkSoft: "#433D33",
  muted: "#6E7263",
  line: "#D8DFC6",
  lineStrong: "#C2CBA9",

  accent: "#A93F1B",
  accentPressed: "#8C3315",
  accentTint: "#F6E4DC",

  brand: "#8A2B1E",

  ok: "#3F6B45",
  okTint: "#E2EDDF",
  warn: "#8A6A21",
  warnTint: "#F5EDD8",
  danger: "#A33327",
  dangerTint: "#F7E3DF",
  info: "#37607F",
  infoTint: "#E1ECF2",

  white: "#FFFFFF",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  title: { fontSize: 21, fontWeight: "700" as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15.5, fontWeight: "400" as const },
  bodyStrong: { fontSize: 15.5, fontWeight: "600" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  // Uppercase section labels, as in the designs.
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: "#1C1A16",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
