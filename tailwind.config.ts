import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
          600: '#0c8c4d',
        },
        flame: {
          400: '#ffb84d',
          500: '#ff8a1f',
          600: '#e55a00',
        },
        ice: {
          400: '#7fd7ff',
          500: '#3fb8ee',
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
        glow: '0 0 32px rgba(34,209,122,0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;
