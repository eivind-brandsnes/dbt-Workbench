import { DEFAULT_THEME_BASE, normalizeThemeBaseColor } from '../utils/theme'

const baseKey = 'dbt_workbench_theme'

const getStorageKey = (userId?: number | null) => {
  if (userId == null) return baseKey
  return `${baseKey}_${userId}`
}

export interface StoredTheme {
  baseColor: string
}

export const loadStoredTheme = (userId?: number | null): StoredTheme | null => {
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredTheme
    if (!parsed?.baseColor) return null
    return { baseColor: normalizeThemeBaseColor(parsed.baseColor) }
  } catch {
    return null
  }
}

export const storeTheme = (theme: StoredTheme, userId?: number | null) => {
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify({
      baseColor: normalizeThemeBaseColor(theme.baseColor),
    }))
  } catch {
    // ignore storage errors
  }
}

export const clearStoredTheme = (userId?: number | null) => {
  try {
    window.localStorage.removeItem(getStorageKey(userId))
  } catch {
    // ignore
  }
}

export const getDefaultTheme = (): StoredTheme => ({ baseColor: DEFAULT_THEME_BASE })
