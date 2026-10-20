/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#080c0a',
          900: '#0d1310',
          850: '#121915',
          800: '#17201c',
          700: '#23302a',
        },
        sage: {
          light: '#b7d5be',
          DEFAULT: '#84a98c',
          dark: '#52796f',
          deep: '#354f52',
        },
        terracotta: {
          light: '#f4978e',
          DEFAULT: '#e07a5f',
          dark: '#b84a39',
        },
        gold: {
          light: '#f6d37f',
          DEFAULT: '#e9c46a',
          dark: '#d4a34b',
        },
      },
      backgroundImage: {
        'radial-gradient': 'radial-gradient(circle at top right, rgba(132, 169, 140, 0.12), transparent 40%), radial-gradient(circle at bottom left, rgba(224, 122, 95, 0.08), transparent 40%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-glow': '0 0 25px -5px rgba(132, 169, 140, 0.15)',
        'terracotta-glow': '0 0 25px -5px rgba(224, 122, 95, 0.2)',
        'gold-glow': '0 0 25px -5px rgba(233, 196, 106, 0.2)',
      },
    },
  },
  plugins: [],
}
