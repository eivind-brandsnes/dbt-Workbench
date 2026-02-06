export type ThemeMode = 'light' | 'dark'

export interface ThemeDefinition {
  baseColor: string
  mode: ThemeMode
  variables: Record<string, string>
}

export const DEFAULT_THEME_BASE = '#22d3ee'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const normalizeHex = (value: string): string => {
  const raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`
  }
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw.split('').map((c) => `${c}${c}`).join('')
    return `#${expanded.toLowerCase()}`
  }
  return DEFAULT_THEME_BASE
}

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return { r, g, b }
}

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const rgbToHsl = (r: number, g: number, b: number) => {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta) % 6
        break
      case gNorm:
        h = (bNorm - rNorm) / delta + 2
        break
      default:
        h = (rNorm - gNorm) / delta + 4
        break
    }
    h *= 60
    if (h < 0) h += 360
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

const hslToRgb = (h: number, s: number, l: number) => {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
  } else if (h >= 120 && h < 180) {
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

const hslToCss = (h: number, s: number, l: number) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`

const relativeLuminance = (r: number, g: number, b: number) => {
  const toLinear = (value: number) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  }
  const rLin = toLinear(r)
  const gLin = toLinear(g)
  const bLin = toLinear(b)
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin
}

const contrastRatio = (rgbA: { r: number; g: number; b: number }, rgbB: { r: number; g: number; b: number }) => {
  const lumA = relativeLuminance(rgbA.r, rgbA.g, rgbA.b)
  const lumB = relativeLuminance(rgbB.r, rgbB.g, rgbB.b)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

const pickContrastingText = (bg: { h: number; s: number; l: number }, hue: number) => {
  const lightText = { h: hue, s: 12, l: 96 }
  const darkText = { h: hue, s: 18, l: 12 }
  const bgRgb = hslToRgb(bg.h, bg.s, bg.l)
  const lightRgb = hslToRgb(lightText.h, lightText.s, lightText.l)
  const darkRgb = hslToRgb(darkText.h, darkText.s, darkText.l)
  const lightContrast = contrastRatio(bgRgb, lightRgb)
  const darkContrast = contrastRatio(bgRgb, darkRgb)

  if (lightContrast >= 4.5 || lightContrast >= darkContrast) {
    return lightText
  }
  return darkText
}

const buildNeutralScale = (h: number, mode: ThemeMode) => {
  const saturation = mode === 'dark' ? 12 : 10
  const lightnessScale = mode === 'dark'
    ? { 50: 96, 100: 90, 200: 82, 300: 72, 400: 60, 500: 48, 600: 36, 700: 26, 800: 18, 900: 12, 950: 7 }
    : { 50: 98, 100: 95, 200: 90, 300: 82, 400: 72, 500: 60, 600: 48, 700: 36, 800: 24, 900: 14, 950: 8 }

  const scale: Record<string, { h: number; s: number; l: number }> = {}
  Object.entries(lightnessScale).forEach(([key, l]) => {
    scale[key] = { h, s: saturation, l }
  })
  return scale
}

const buildAccentScale = (base: { h: number; s: number; l: number }) => {
  const saturation = clamp(base.s, 20, 95)
  const baseL = clamp(base.l, 8, 92)
  const deltas: Record<string, number> = {
    50: 45,
    100: 35,
    200: 25,
    300: 15,
    400: 7,
    500: 0,
    600: -7,
    700: -15,
    800: -23,
    900: -31,
    950: -40,
  }
  const scale: Record<string, { h: number; s: number; l: number }> = {}
  Object.entries(deltas).forEach(([key, delta]) => {
    scale[key] = {
      h: base.h,
      s: saturation,
      l: clamp(baseL + delta, 6, 96),
    }
  })
  return scale
}

export const toHexFromHsl = (h: number, s: number, l: number) => {
  const rgb = hslToRgb(h, s, l)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

export const hexToHsl = (hex: string) => {
  const rgb = hexToRgb(hex)
  return rgbToHsl(rgb.r, rgb.g, rgb.b)
}

export const getPreferredColorScheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const generateTheme = (baseColor: string, mode: ThemeMode): ThemeDefinition => {
  const normalized = normalizeHex(baseColor)
  const baseRgb = hexToRgb(normalized)
  const base = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b)
  const neutral = buildNeutralScale(base.h, mode)
  const accent = buildAccentScale(base)

  const background = mode === 'dark' ? neutral[950] : neutral[50]
  const surface = mode === 'dark' ? neutral[900] : neutral[100]
  const panel = mode === 'dark' ? neutral[900] : neutral[50]
  const border = mode === 'dark' ? neutral[800] : neutral[200]
  const text = pickContrastingText(background, base.h)
  const textMuted = mode === 'dark' ? neutral[300] : neutral[600]
  const primary = { h: base.h, s: clamp(base.s, 20, 95), l: clamp(base.l, 8, 92) }
  const secondary = { h: (base.h + 30) % 360, s: clamp(base.s * 0.75, 18, 85), l: clamp(base.l, 10, 90) }
  const primaryText = pickContrastingText(primary, base.h)
  const secondaryText = pickContrastingText(secondary, base.h)
  const ring = mode === 'dark' ? accent[400] : accent[600]

  const variables: Record<string, string> = {
    '--color-bg': hslToCss(background.h, background.s, background.l),
    '--color-surface': hslToCss(surface.h, surface.s, surface.l),
    '--color-panel': hslToCss(panel.h, panel.s, panel.l),
    '--color-text': hslToCss(text.h, text.s, text.l),
    '--color-text-muted': hslToCss(textMuted.h, textMuted.s, textMuted.l),
    '--color-border': hslToCss(border.h, border.s, border.l),
    '--color-ring': hslToCss(ring.h, ring.s, ring.l),
    '--color-primary': hslToCss(primary.h, primary.s, primary.l),
    '--color-secondary': hslToCss(secondary.h, secondary.s, secondary.l),
    '--color-accent': hslToCss(accent[500].h, accent[500].s, accent[500].l),
    '--color-primary-foreground': hslToCss(primaryText.h, primaryText.s, primaryText.l),
    '--color-secondary-foreground': hslToCss(secondaryText.h, secondaryText.s, secondaryText.l),
  }

  Object.entries(neutral).forEach(([key, value]) => {
    variables[`--color-neutral-${key}`] = hslToCss(value.h, value.s, value.l)
  })

  Object.entries(accent).forEach(([key, value]) => {
    variables[`--color-accent-${key}`] = hslToCss(value.h, value.s, value.l)
  })

  return {
    baseColor: normalized,
    mode,
    variables,
  }
}

export const applyThemeVariables = (definition: ThemeDefinition) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  Object.entries(definition.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.style.colorScheme = definition.mode
}

export const normalizeThemeBaseColor = normalizeHex
