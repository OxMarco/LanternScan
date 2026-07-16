const plugin = require('tailwindcss/plugin');

const { theme: palette } = require('./src/lib/theme');

function toChannels(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function cssVariables(palette, prefix = '--color') {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`${prefix}-${key}`, toChannels(value)])
  );
}

function variableColors(palette, prefix = '--color') {
  return Object.fromEntries(
    Object.keys(palette).map((key) => [key, `rgb(var(${prefix}-${key}) / <alpha-value>)`])
  );
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: variableColors(palette),
    },
  },
  plugins: [
    plugin(({ addBase }) =>
      addBase({
        ':root': cssVariables(palette),
      })
    ),
  ],
};
