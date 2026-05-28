/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "surface-container": "#201f21",
        "on-surface": "#e5e1e4",
        "secondary-fixed-dim": "#ffb3b2",
        "on-tertiary-fixed": "#002022",
        "on-primary-container": "#efefff",
        "surface-container-highest": "#353437",
        "outline-variant": "#434656",
        "on-secondary-container": "#5b0010",
        "on-tertiary": "#00363a",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        "surface-container-low": "#1b1b1d",
        "secondary-container": "#ff525e",
        "surface-tint": "#b8c3ff",
        "tertiary-fixed-dim": "#00dbe9",
        "primary": "#b8c3ff",
        "inverse-primary": "#124af0",
        "surface-bright": "#39393b",
        "tertiary": "#00dbe9",
        "primary-fixed-dim": "#b8c3ff",
        "secondary-fixed": "#ffdad9",
        "on-secondary-fixed-variant": "#92001f",
        "on-primary-fixed": "#001356",
        "surface-dim": "#131315",
        "on-primary-fixed-variant": "#0035be",
        "on-tertiary-container": "#c4faff",
        "primary-container": "#2e5bff",
        "on-surface-variant": "#c4c5d9",
        "inverse-on-surface": "#303032",
        "surface": "#131315",
        "on-error-container": "#ffdad6",
        "on-background": "#e5e1e4",
        "surface-container-lowest": "#0e0e10",
        "on-secondary-fixed": "#410008",
        "tertiary-container": "#007981",
        "surface-container-high": "#2a2a2c",
        "outline": "#8e90a2",
        "tertiary-fixed": "#7df4ff",
        "on-tertiary-fixed-variant": "#004f54",
        "background": "#131315",
        "on-primary": "#002388",
        "on-secondary": "#680013",
        "primary-fixed": "#dde1ff",
        "inverse-surface": "#e5e1e4",
        "surface-variant": "#353437",
        "secondary": "#ffb3b2",
        "on-error": "#690005"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "full": "9999px"
      },
      "spacing": {
        "stack-sm": "8px",
        "stack-md": "20px",
        "unit": "4px",
        "margin": "24px",
        "stack-lg": "40px",
        "gutter": "16px"
      },
      "fontFamily": {
        "label-caps": ["Space Grotesk", "sans-serif"],
        "headline-md": ["Bungee", "cursive"],
        "headline-lg": ["Bungee", "cursive"],
        "body-sm": ["Spline Sans", "sans-serif"],
        "body-lg": ["Spline Sans", "sans-serif"]
      },
      "fontSize": {
        "label-caps": ["12px", { "lineHeight": "1", "letterSpacing": "0.1em", "fontWeight": "700" }],
        "headline-md": ["32px", { "lineHeight": "1.2", "fontWeight": "400" }],
        "headline-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "400" }],
        "body-sm": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "body-lg": ["18px", { "lineHeight": "1.6", "fontWeight": "400" }]
      }
    }
  },
  plugins: [],
}
