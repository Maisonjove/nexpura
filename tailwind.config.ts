import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        'soft-gray': {
          DEFAULT: '#F8F9FA',
          light: '#F1F3F5',
        },
        'charcoal': '#111827',
        'accent-teal': '#0F766E',
        'brand': {
          '50': '#f0f9f8',
          '100': '#dff2f1',
          '200': '#c3e7e4',
          '300': '#9cd8d3',
          '400': '#6ec3be',
          '500': '#4fabab',
          '600': '#3b8a8a',
          '700': '#32706f',
          '800': '#2d5d5c',
          '900': '#2a4f4e',
          '950': '#1a3434',
        },
      },
      borderRadius: {
        xl: \`0.75rem\`,
        lg: \`0.5rem\`,
        md: \`0.375rem\`,
        sm: '0.25rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      }
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
export default config
