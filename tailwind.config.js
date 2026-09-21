function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

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
          darkest: withOpacity('--steam-darkest-rgb'),
          darker: withOpacity('--steam-darker-rgb'),
          dark: withOpacity('--steam-dark-rgb'),
          card: withOpacity('--steam-card-rgb'),
          cardHover: withOpacity('--steam-card-hover-rgb'),
          border: withOpacity('--steam-border-rgb'),
          accent: withOpacity('--steam-accent-rgb'),
          accentHover: withOpacity('--steam-accent-hover-rgb'),
          neon: withOpacity('--steam-neon-rgb'),
          text: withOpacity('--steam-text-rgb'),
          muted: withOpacity('--steam-muted-rgb'),
          green: withOpacity('--steam-green-rgb'),
          success: withOpacity('--steam-success-rgb'),
          missing: withOpacity('--steam-missing-rgb'),
        },
      },
      fontFamily: {
        sans: ['Segoe UI Variable', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 15px rgba(var(--steam-accent-rgb), 0.35)',
        'glow-green': '0 0 15px rgba(var(--steam-green-rgb), 0.35)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 12px rgba(var(--steam-accent-rgb), 0.2)',
      },
    },
  },
  plugins: [],
}
