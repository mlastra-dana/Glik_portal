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
          primary: '#12002F',
          secondary: '#2A1460',
          accent: '#F8981D',
          light: '#F4F1FA',
          success: '#0C9B5A',
          warning: '#D99A00',
          danger: '#DC3B46',
          info: '#6D3ACF'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(18, 0, 47, 0.16)',
        card: '0 8px 24px rgba(18, 0, 47, 0.20)'
      },
      backgroundImage: {
        'hero-mesh':
          'radial-gradient(circle at 20% 20%, rgba(109, 58, 207, 0.22), transparent 40%), radial-gradient(circle at 80% 0%, rgba(248, 152, 29, 0.18), transparent 30%), linear-gradient(135deg, #12002F 0%, #2A1460 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;
