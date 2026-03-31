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
          primary: '#0B6AF0',
          secondary: '#0F1C34',
          accent: '#F68A2D',
          light: '#F4F7FC',
          success: '#0C9B5A',
          warning: '#E7A512',
          danger: '#DC3B46',
          info: '#0284C7'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 28, 52, 0.08)',
        card: '0 8px 24px rgba(11, 106, 240, 0.10)'
      },
      backgroundImage: {
        'hero-mesh':
          'radial-gradient(circle at 20% 20%, rgba(11, 106, 240, 0.2), transparent 40%), radial-gradient(circle at 80% 0%, rgba(246, 138, 45, 0.18), transparent 30%), linear-gradient(135deg, #0F1C34 0%, #12325D 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;
