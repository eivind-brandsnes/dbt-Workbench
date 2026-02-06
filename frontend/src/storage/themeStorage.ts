import { ThemePreference } from '../utils/theme'

const baseKey = 'dbt_workbench_theme'

const getStorageKey = (userId?: number | null) => {
  if (userId == null) return baseKey
  return `${baseKey}_${userId}`
}

export type StoredTheme = ThemePreference

export const loadStoredTheme = (userId?: number | null): StoredTheme | null => {
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredTheme
    if (!parsed?.light?.colors || !parsed?.dark?.colors) return null
    return parsed
  } catch {
    return null
  }
}

export const storeTheme = (theme: StoredTheme, userId?: number | null) => {
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(theme))
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
