import { create } from "zustand"

export type ThemeChoice = "light" | "dark" | "system"

const THEME_KEY = "sosim.theme"

function readStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system"
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") return stored
  return "system"
}

function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return
  const resolved =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice
  document.documentElement.classList.toggle("dark", resolved === "dark")
  document.documentElement.style.colorScheme = resolved
}

const initialTheme = readStoredTheme()
applyTheme(initialTheme)

interface UiStore {
  theme: ThemeChoice
  setTheme: (theme: ThemeChoice) => void
}

export const useUiStore = create<UiStore>()((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_KEY, theme)
    set({ theme })
  },
}))