import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Sora', 'sans-serif']
      },
      colors: {
        glik: {
          primary: '#1F0249',
          secondary: '#6638B6',
          secondaryStrong: '#4F2DA4',
          accent: '#FF8F1C',
          light: '#F3F0FB',
          success: '#0C9B5A',
          warning: '#D99A00',
          danger: '#DC3B46',
          info: '#6D3ACF'
        }
      },
      boxShadow: {
        soft: '0 10px 26px rgba(31, 2, 73, 0.12)',
        card: '0 10px 28px rgba(31, 2, 73, 0.18)'
      },
      backgroundImage: {
        'hero-mesh':
          'radial-gradient(circle at 20% 20%, rgba(102, 56, 182, 0.30), transparent 42%), radial-gradient(circle at 85% 5%, rgba(255, 143, 28, 0.20), transparent 34%), linear-gradient(135deg, #1F0249 0%, #3A1A7E 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;
