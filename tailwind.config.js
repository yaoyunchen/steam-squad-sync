/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        steam: {
          darkest: '#0e141b',
          darker: '#121a24',
          dark: '#17202d',
          card: '#1b2838',
          cardHover: '#233348',
          border: '#2a475e',
          accent: '#66c0f4',
          accentHover: '#1999ff',
          neon: '#00ffee',
          text: '#c6d4df',
          muted: '#8f98a0',
          green: '#a4d007',
          success: '#5c7e10',
          missing: '#ff5c5c',
        },
      },
      fontFamily: {
        sans: ['Segoe UI Variable', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 15px rgba(102, 192, 244, 0.35)',
        'glow-green': '0 0 15px rgba(164, 208, 7, 0.35)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 12px rgba(102, 192, 244, 0.2)',
      },
    },
  },
  plugins: [],
}
