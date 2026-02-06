import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'
import {
  DEFAULT_THEME_BASE,
  ThemeMode,
  applyThemeVariables,
  generateTheme,
  getPreferredColorScheme,
  normalizeThemeBaseColor,
} from '../utils/theme'
import { clearStoredTheme, loadStoredTheme, storeTheme } from '../storage/themeStorage'

interface ThemePreferenceResponse {
  base_color: string
}

interface ThemeContextValue {
  baseColor: string
  mode: ThemeMode
  isLoading: boolean
  setBaseColor: (color: string) => void
  resetTheme: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_SAVE_DEBOUNCE_MS = 400

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading: authLoading, user, isAuthEnabled } = useAuth()
  const [baseColor, setBaseColorState] = useState(DEFAULT_THEME_BASE)
  const [mode, setMode] = useState<ThemeMode>(getPreferredColorScheme())
  const [isLoading, setIsLoading] = useState(true)
  const persistTimeoutRef = useRef<number | null>(null)
  const lastUserIdRef = useRef<number | null>(user?.id ?? null)
  const hydratingRef = useRef(false)

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
    applyThemeVariables(generateTheme(baseColor, mode))
  }, [baseColor, mode])

  const loadTheme = useCallback(async () => {
    if (authLoading) return
    hydratingRef.current = true
    setIsLoading(true)

    const userId = user?.id ?? null
    const local = loadStoredTheme(userId)

    try {
      const res = await api.get<ThemePreferenceResponse>('/theme')
      const serverColor = normalizeThemeBaseColor(res.data.base_color)
      setBaseColorState(serverColor)
      storeTheme({ baseColor: serverColor }, userId)
    } catch {
      if (local?.baseColor) {
        setBaseColorState(local.baseColor)
      } else {
        setBaseColorState(DEFAULT_THEME_BASE)
      }
    } finally {
      hydratingRef.current = false
      setIsLoading(false)
    }
  }, [authLoading, user?.id, isAuthEnabled])

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

  const schedulePersist = useCallback((color: string) => {
    if (hydratingRef.current) return
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }
    persistTimeoutRef.current = window.setTimeout(async () => {
      try {
        await api.put('/theme', { base_color: color })
      } catch {
        // Non-blocking; local theme still applied
      }
    }, THEME_SAVE_DEBOUNCE_MS)
  }, [])

  const setBaseColor = useCallback((color: string) => {
    const normalized = normalizeThemeBaseColor(color)
    setBaseColorState(normalized)
    storeTheme({ baseColor: normalized }, user?.id ?? null)
    schedulePersist(normalized)
  }, [schedulePersist, user?.id])

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
    setBaseColorState(DEFAULT_THEME_BASE)
  }, [user?.id])

  const value = useMemo<ThemeContextValue>(() => ({
    baseColor,
    mode,
    isLoading,
    setBaseColor,
    resetTheme,
  }), [baseColor, mode, isLoading, setBaseColor, resetTheme])

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
