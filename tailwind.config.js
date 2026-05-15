/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Trebuchet MS"', 'Verdana', 'sans-serif'],
        body: ['"Nunito"', '"Trebuchet MS"', 'Verdana', 'sans-serif'],
      },
      boxShadow: {
        rpg: '0 16px 0 rgba(55, 27, 18, 0.28), 0 24px 50px rgba(31, 41, 55, 0.35)',
      },
    },
  },
  plugins: [],
};
