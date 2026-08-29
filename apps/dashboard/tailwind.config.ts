import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B0E14',
          900: '#10141B',
          850: '#141A23',
          800: '#18202C',
          750: '#1E2736',
          700: '#263245',
          600: '#3B4B63',
          500: '#5A6D8B',
          400: '#7E90AC',
          300: '#A8B7CD',
          200: '#CBD5E1',
          100: '#E6EDF6',
        },
        ledger: {
          DEFAULT: '#EDEAE0',
          surface: '#F5F3ED',
          border: '#D8D4C7',
          ink: '#10141B',
          muted: '#5C584E',
        },
        signal: {
          DEFAULT: '#2E7D5C',
          light: '#3EA67A',
          bg: '#0B1E16',
          border: '#1B4D38',
        },
        amber: {
          DEFAULT: '#C98A2E',
          light: '#E5A442',
          bg: '#221706',
          border: '#573B12',
        },
        route: {
          DEFAULT: '#4C6B8A',
          light: '#648CAE',
          bg: '#0F1A24',
          border: '#23374A',
        },
        redline: {
          DEFAULT: '#B23A2E',
          light: '#D44E41',
          bg: '#220B08',
          border: '#521812',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        sans: ['var(--font-plex-sans)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
