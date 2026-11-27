/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101b2d', navy: '#15243b', coral: '#ff5b3d', tangerine: '#ff9f1c',
        mint: '#10b981', cream: '#fff8f1', mist: '#f4f6fa', line: '#e7eaf0',
      },
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 10px 35px -18px rgba(16,27,45,.28)', float: '0 18px 50px -16px rgba(16,27,45,.35)' },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: { fadeUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } },
      animation: { fadeUp: 'fadeUp .35s ease-out both' },
    },
  },
  plugins: [],
};
