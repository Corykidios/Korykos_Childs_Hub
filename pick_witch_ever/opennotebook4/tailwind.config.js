/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        notebook: {
          bg: '#0e1117',
          panel: '#1e222b',
          panelHeader: '#1e222b',
          card: '#272b35',
          cardHover: '#323744',
          border: '#2c323f',
          accent: '#8ab4f8',
          textMuted: '#9aa0a6',
        }
      }
    },
  },
  plugins: [],
}
