/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'ee-bg':           '#031427',
        'ee-surface':      'rgba(16,32,52,0.6)',
        'ee-gold':         '#e9c176',
        'ee-emerald':      '#4edea3',
        'ee-primary':      '#bec6e0',
        'ee-muted':        '#8892a4',
        'ee-border':       'rgba(69,70,77,0.5)',
        // App-shell surfaces (matched to the HTML prototypes)
        'ee-surface-low':  '#0b1c30',
        'ee-surface-mid':  '#102034',
        'ee-surface-high': '#1b2b3f',
        'ee-outline':      '#45464d',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body:    ['Inter', 'sans-serif'],
        data:    ['IBM Plex Sans', 'sans-serif'],
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
}
