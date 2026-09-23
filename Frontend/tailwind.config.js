/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-dark': '#087A18',
        primary: '#1ABC0A',
        'primary-light': '#B9E8B5',
        accent: '#F5D928',
        secondary: '#C51F24',
        institutional: '#245B9E',
        ink: '#263238',
        border: '#DDE3E0',
        background: '#F5F7F6',
      },
    },
  },
  plugins: [],
}
