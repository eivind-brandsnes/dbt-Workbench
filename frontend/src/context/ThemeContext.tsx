import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'
import {
  ThemeColorKey,
  ThemeMode,
  ThemePreference,
  ThemeResolved,
  applyThemeVariables,
  buildThemeMode,
  getDefaultThemePreference,
  getPreferredColorScheme,
} from '../utils/theme'
import { clearStoredTheme, loadStoredTheme, storeTheme } from '../storage/themeStorage'

interface ThemeContextValue {
  mode: ThemeMode
  isLoading: boolean
  resolved: Record<ThemeMode, ThemeResolved>
  setColor: (mode: ThemeMode, key: ThemeColorKey, value: string) => void
  resetTheme: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_SAVE_DEBOUNCE_MS = 500

const buildResolvedFromPreference = (preference: ThemePreference): Record<ThemeMode, ThemeResolved> => ({
  light: buildThemeMode('light', preference.light.colors),
  dark: buildThemeMode('dark', preference.dark.colors),
})

const buildPreferenceFromResolved = (resolved: Record<ThemeMode, ThemeResolved>): ThemePreference => ({
  version: 1,
  light: { colors: resolved.light.colors, derived: resolved.light.derived },
  dark: { colors: resolved.dark.colors, derived: resolved.dark.derived },
})

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading: authLoading, user } = useAuth()
  const [mode, setMode] = useState<ThemeMode>(getPreferredColorScheme())
  const [resolved, setResolved] = useState<Record<ThemeMode, ThemeResolved>>(() =>
    buildResolvedFromPreference(getDefaultThemePreference())
  )
  const [isLoading, setIsLoading] = useState(true)
  const persistTimeoutRef = useRef<number | null>(null)
  const hydratingRef = useRef(false)
  const lastUserIdRef = useRef<number | null>(user?.id ?? null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateMode = () => setMode(media.matches ? 'dark' : 'light')
    updateMode()
    if (media.addEventListener) {
      media.addEventListener('change', updateMode)
      return () => media.removeEventListener('change', updateMode)
    }
    media.addListener(updateMode)
    return () => media.removeListener(updateMode)
  }, [])

  useEffect(() => {
    applyThemeVariables(resolved[mode])
  }, [resolved, mode])

  const loadTheme = useCallback(async () => {
    if (authLoading) return
    hydratingRef.current = true
    setIsLoading(true)

    const userId = user?.id ?? null
    const local = loadStoredTheme(userId)

    if (local) {
      setResolved(buildResolvedFromPreference(local))
    }

    try {
      const res = await api.get<ThemePreference>('/theme')
      const preference = res.data
      setResolved(buildResolvedFromPreference(preference))
      storeTheme(preference, userId)
    } catch {
      if (!local) {
        const fallback = getDefaultThemePreference()
        setResolved(buildResolvedFromPreference(fallback))
      }
    } finally {
      hydratingRef.current = false
      setIsLoading(false)
    }
  }, [authLoading, user?.id])

  useEffect(() => {
    const currentUserId = user?.id ?? null
    if (lastUserIdRef.current !== currentUserId) {
      clearStoredTheme(lastUserIdRef.current)
      lastUserIdRef.current = currentUserId
    }
  }, [user?.id])

  useEffect(() => {
    if (!authLoading) {
      void loadTheme()
    }
  }, [authLoading, loadTheme])

  const schedulePersist = useCallback((preference: ThemePreference) => {
    if (hydratingRef.current) return
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }
    persistTimeoutRef.current = window.setTimeout(async () => {
      try {
        await api.put('/theme', preference)
      } catch {
        // ignore persistence errors; UI already updated locally
      }
    }, THEME_SAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    if (hydratingRef.current || isLoading) return
    const preference = buildPreferenceFromResolved(resolved)
    storeTheme(preference, user?.id ?? null)

    const allValid = resolved.light.validation.isValid && resolved.dark.validation.isValid
    if (allValid) {
      schedulePersist(preference)
    }
  }, [resolved, schedulePersist, user?.id, isLoading])

  const setColor = useCallback((targetMode: ThemeMode, key: ThemeColorKey, value: string) => {
    setResolved((prev) => {
      const currentColors = {
        ...prev[targetMode].colors,
        [key]: value,
      }
      const updated = buildThemeMode(targetMode, currentColors)
      return {
        ...prev,
        [targetMode]: updated,
      }
    })
  }, [])

  const resetTheme = useCallback(async () => {
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }
    try {
      await api.delete('/theme')
    } catch {
      // ignore
    }
    clearStoredTheme(user?.id ?? null)
    const fallback = getDefaultThemePreference()
    setResolved(buildResolvedFromPreference(fallback))
  }, [user?.id])

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    isLoading,
    resolved,
    setColor,
    resetTheme,
  }), [mode, isLoading, resolved, setColor, resetTheme])

  if (isLoading) {
    return null
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
