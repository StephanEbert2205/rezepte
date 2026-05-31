/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#fad7ac',
          300: '#f6bc77',
          400: '#f1963f',
          500: '#ee7a1b',
          600: '#df6011',
          700: '#b94810',
          800: '#933915',
          900: '#773114',
          950: '#401607',
        },
      },
    },
  },
  plugins: [],
};
