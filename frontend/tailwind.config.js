/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#c0c0c0',
        'primary-hover': '#a0a0a0',
        'background-light': '#f6f5f8',
        'background-dark': '#121118',
        'surface-dark': '#1c1b22',
        'surface-dark-lighter': '#2a2933',
        'theme-bg': 'var(--bg-primary)',
        'theme-bg-secondary': 'var(--bg-secondary)',
        'theme-bg-tertiary': 'var(--bg-tertiary)',
        'theme-text': 'var(--text-primary)',
        'theme-text-secondary': 'var(--text-secondary)',
        'theme-text-tertiary': 'var(--text-tertiary)',
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px',
      },
      backgroundImage: {
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #121118 0deg, #c0c0c0 180deg, #121118 360deg)',
        'mesh': 'radial-gradient(at 0% 0%, rgba(192, 192, 192, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(192, 192, 192, 0.1) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
};
