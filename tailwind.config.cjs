module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        // Modern CSS: Container queries support
        '@container': {
          'sm': '320px',
          'md': '480px',
          'lg': '768px',
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        // Modern CSS: New units
        'cap': '1cap',
        'lh': '1lh',
        'rlh': '1rlh',
        'ic': '1ic',
      },
      height: {
        // Modern CSS: Dynamic viewport units
        'dvh': '100dvh',
        'lvh': '100lvh',
        'svh': '100svh',
        'dvh-50': '50dvh',
        'lvh-50': '50lvh',
        'svh-50': '50svh',
      },
      minHeight: {
        'dvh': '100dvh',
        'lvh': '100lvh',
        'svh': '100svh',
      },
      maxHeight: {
        'dvh': '100dvh',
        'lvh': '100lvh',
        'svh': '100svh',
      },
      width: {
        // Modern CSS: Dynamic viewport units
        'dvw': '100dvw',
        'lvw': '100lvw',
        'svw': '100svw',
      },
      maxWidth: {
        'screen-xs': '475px',
        'dvw': '100dvw',
        'lvw': '100lvw',
        'svw': '100svw',
      },
      fontSize: {
        'xs-mobile': ['0.65rem', { lineHeight: '1rem' }],
        'sm-mobile': ['0.75rem', { lineHeight: '1.25rem' }],
        // Modern CSS: cap unit based typography
        'cap-sm': ['1cap', { lineHeight: '1.2cap' }],
        'cap-base': ['1.2cap', { lineHeight: '1.4cap' }],
        'cap-lg': ['1.5cap', { lineHeight: '1.7cap' }],
      },
      aspectRatio: {
        // Modern CSS: Extended aspect ratios
        'golden': '1.618',
        '4/3': '4 / 3',
        '3/2': '3 / 2',
        '2/3': '2 / 3',
        '9/16': '9 / 16',
        '21/9': '21 / 9',
      },
      backdropBlur: {
        'xs': '2px',
      },
      transitionTimingFunction: {
        // Modern CSS: Linear easing function
        'bounce-out': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'linear-ease': 'linear(0, 0.0036 9.62%, 0.0185 16.66%, 0.0489 23.03%, 0.0962 28.86%, 0.1705 34.93%, 0.269 40.66%, 0.3867 45.89%, 0.5833 52.95%, 0.683 57.05%, 0.7829 62.14%, 0.8621 67.46%, 0.8991 70.68%, 0.9299 74.03%, 0.9545 77.52%, 0.9735 81.21%, 0.9865 85%, 0.9949 89.15%, 1)',
        'steps-ease': 'steps(10, end)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-light': 'bounceLight 1s infinite',
        // Modern CSS: Enhanced animations with new timing functions
        'scale-smooth': 'scaleSmooth 0.3s linear-ease',
        'slide-smooth': 'slideSmooth 0.4s linear-ease',
        'rotate-smooth': 'rotateSmooth 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceLight: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        // Modern CSS: Individual transform properties in keyframes
        scaleSmooth: {
          '0%': { scale: '1' },
          '50%': { scale: '1.1' },
          '100%': { scale: '1' },
        },
        slideSmooth: {
          '0%': { translate: '-100% 0' },
          '100%': { translate: '0 0' },
        },
        rotateSmooth: {
          '0%': { rotate: '0deg' },
          '100%': { rotate: '360deg' },
        },
      },
      // Modern CSS: Color enhancements
      colors: {
        // HWB color support
        'hwb-primary': 'hwb(240 20% 10%)',
        'hwb-secondary': 'hwb(120 15% 5%)',
        'hwb-accent': 'hwb(60 10% 20%)',
      },
      backgroundImage: {
        // Modern CSS: Conic gradients
        'conic-primary': 'conic-gradient(from 0deg at 50% 50%, var(--tw-gradient-stops))',
        'conic-rainbow': 'conic-gradient(from 0deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff0080, #ff0000)',
        'conic-subtle': 'conic-gradient(from 45deg at 50% 50%, #e0e7ff, #c7d2fe, #a5b4fc, #818cf8)',
      },
      // Modern CSS: Enhanced typography
      textDecorationThickness: {
        'auto': 'auto',
        'from-font': 'from-font',
        '0': '0px',
        '1': '1px',
        '2': '2px',
        '4': '4px',
        '8': '8px',
      },
      textUnderlineOffset: {
        'auto': 'auto',
        '0': '0px',
        '1': '1px',
        '2': '2px',
        '4': '4px',
        '8': '8px',
      },
      // Modern CSS: Scroll behavior
      scrollMargin: {
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
      },
      scrollPadding: {
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
      },
    },
  },
  plugins: [],
}; 