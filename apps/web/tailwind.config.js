/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#402920', navy: '#633b2b', coral: '#bd3d1e', tangerine: '#a84c0e',
        mint: '#39774b', cream: '#fff8ef', mist: '#fbf6ee', line: '#eaded0',
      },
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 10px 35px -18px rgba(80,43,28,.28)', float: '0 18px 50px -16px rgba(80,43,28,.35)' },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: { fadeUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } },
      animation: { fadeUp: 'fadeUp .35s ease-out both' },
    },
  },
  plugins: [],
};
