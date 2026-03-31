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
          primary: '#110027',
          secondary: '#1A0838',
          accent: '#F8981D',
          light: '#F7F4FB',
          success: '#0C9B5A',
          warning: '#D99A00',
          danger: '#DC3B46',
          info: '#6D3ACF'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(17, 0, 39, 0.08)',
        card: '0 8px 24px rgba(17, 0, 39, 0.16)'
      },
      backgroundImage: {
        'hero-mesh':
          'radial-gradient(circle at 20% 20%, rgba(109, 58, 207, 0.22), transparent 40%), radial-gradient(circle at 80% 0%, rgba(248, 152, 29, 0.22), transparent 30%), linear-gradient(135deg, #110027 0%, #1A0838 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;
