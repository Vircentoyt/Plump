const STORAGE_KEY = "plump-theme";

export const THEMES = {
  classic: {
    id: "classic",
    label: "Klassisk",
    description: "Grön filt med guldkant.",
  },
  minecraft: {
    id: "minecraft",
    label: "Minecraft",
    description: "Gräs, creeper och block.",
    menuSound: true,
  },
  scifi80: {
    id: "scifi80",
    label: "Sci-Fi 80-tal",
    description: "Neon, synth och laserkanoner.",
    laserEnabled: true,
  },
};

const listeners = new Set();

const DEFAULT_PLAYER_NAMES = ["Du", "AI Anna", "AI Erik"];
const MINECRAFT_PLAYER_NAMES = ["Du", "Sssanna", "Boomerik"];

export function getPlayerNames(themeId = getThemeId()) {
  if (themeId === "minecraft") {
    return MINECRAFT_PLAYER_NAMES;
  }
  return DEFAULT_PLAYER_NAMES;
}

export function getThemeId() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && THEMES[stored] ? stored : "classic";
}

export function getTheme() {
  return THEMES[getThemeId()];
}

export function isLaserEnabled() {
  return Boolean(getTheme().laserEnabled);
}

export function isMinecraftTheme() {
  return getThemeId() === "minecraft";
}

export function applyTheme(themeId) {
  const theme = THEMES[themeId] ?? THEMES.classic;
  document.documentElement.dataset.theme = theme.id;
  localStorage.setItem(STORAGE_KEY, theme.id);
  listeners.forEach((callback) => callback(theme.id));
  return theme.id;
}

export function initTheme() {
  return applyTheme(getThemeId());
}

export function onThemeChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
