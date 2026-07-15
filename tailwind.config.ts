import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light "app" surfaces.
        canvas: '#f3f5f8',
        surface: '#ffffff',
        ink: {
          950: '#07090c',
          900: '#0b0f14',
          800: '#111821',
          700: '#1a2330',
          600: '#2a3444',
        },
        pitch: {
          400: '#22d17a',
          500: '#12b866',
          600: '#0c9a55',
          700: '#0c8c4d',
        },
        flame: {
          400: '#ffb84d',
          500: '#ff8a1f',
          600: '#e55a00',
        },
        ice: {
          400: '#7fd7ff',
          500: '#3fb8ee',
          600: '#1f8fc9',
        },
      },
      fontFamily: {
        display: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        clock: 'clamp(6rem, 22vw, 14rem)',
        clockSmall: 'clamp(3rem, 12vw, 6rem)',
      },
      boxShadow: {
        glow: '0 10px 24px -6px rgba(12,154,85,0.45)',
        card: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -12px rgba(15,23,42,0.12)',
        dock: '0 -2px 8px rgba(15,23,42,0.04), 0 12px 32px -8px rgba(15,23,42,0.18)',
        raised: '0 8px 20px -4px rgba(12,154,85,0.5)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
