import type { Config } from 'tailwindcss'

const withAlpha = (cssVar: string) => `hsl(var(${cssVar}) / <alpha-value>)`

const scale = (prefix: string) => ({
  50: withAlpha(`--color-${prefix}-50`),
  100: withAlpha(`--color-${prefix}-100`),
  200: withAlpha(`--color-${prefix}-200`),
  300: withAlpha(`--color-${prefix}-300`),
  400: withAlpha(`--color-${prefix}-400`),
  500: withAlpha(`--color-${prefix}-500`),
  600: withAlpha(`--color-${prefix}-600`),
  700: withAlpha(`--color-${prefix}-700`),
  800: withAlpha(`--color-${prefix}-800`),
  900: withAlpha(`--color-${prefix}-900`),
  950: withAlpha(`--color-${prefix}-950`),
})

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: withAlpha('--color-bg'),
        surface: withAlpha('--color-surface'),
        panel: withAlpha('--color-panel'),
        text: withAlpha('--color-text'),
        muted: withAlpha('--color-text-muted'),
        border: withAlpha('--color-border'),
        ring: withAlpha('--color-ring'),
        primary: withAlpha('--color-primary'),
        'primary-foreground': withAlpha('--color-primary-foreground'),
        secondary: withAlpha('--color-secondary'),
        'secondary-foreground': withAlpha('--color-secondary-foreground'),
        accent: withAlpha('--color-accent'),
        gray: scale('neutral'),
        slate: scale('neutral'),
        neutral: scale('neutral'),
        blue: scale('accent'),
        sky: scale('accent'),
        cyan: scale('accent'),
        indigo: scale('accent'),
      },
    },
  },
  plugins: [],
}
export default config
