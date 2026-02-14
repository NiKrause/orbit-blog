/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--bg)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
        },
        content: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          hover: 'var(--danger-hover)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow)',
        'lg': 'var(--shadow-lg)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'var(--text)',
            a: {
              color: 'var(--text)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              '&:hover': {
                color: 'var(--text-secondary)',
              },
            },
            strong: { color: 'var(--text)' },
            h1: { color: 'var(--text)' },
            h2: { color: 'var(--text)' },
            h3: { color: 'var(--text)' },
            h4: { color: 'var(--text)' },
            blockquote: {
              color: 'var(--text-secondary)',
              borderLeftColor: 'var(--border)',
            },
            code: {
              color: 'var(--text)',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '0.125rem 0.25rem',
              borderRadius: '4px',
              fontWeight: '400',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            pre: {
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            },
            hr: { borderColor: 'var(--border)' },
            thead: {
              borderBottomColor: 'var(--border)',
            },
            'tbody tr': {
              borderBottomColor: 'var(--border-subtle)',
            },
            th: { color: 'var(--text)' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')
  ],
}
