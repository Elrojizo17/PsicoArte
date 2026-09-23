/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-dark': '#0D47A1',
        primary: '#2196F3',
        'primary-light': '#90CAF9',
        background: '#E3F2FD',
      },
    },
  },
  plugins: [],
}

