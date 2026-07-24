import Aura from '@primeuix/themes/aura';
import Lara from '@primeuix/themes/lara';
import { definePreset } from '@primeuix/themes';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** Build a palette map that references a built-in color, e.g. {blue.500}. */
function palette(name) {
  return Object.fromEntries(SHADES.map((s) => [s, `{${name}.${s}}`]));
}

/** Lara preset with a remapped primary color palette. */
const laraColor = (name) =>
  definePreset(Lara, {
    semantic: { primary: palette(name) },
  });

/**
 * Aura "Noir": monochrome primary that flips with the color scheme, per the
 * official PrimeVue v4 Noir recipe.
 */
const AuraNoir = definePreset(Aura, {
  semantic: {
    primary: palette('zinc'),
    colorScheme: {
      light: {
        primary: {
          color: '{zinc.950}',
          contrastColor: '#ffffff',
          hoverColor: '{zinc.900}',
          activeColor: '{zinc.800}',
        },
      },
      dark: {
        primary: {
          color: '{zinc.50}',
          contrastColor: '{zinc.950}',
          hoverColor: '{zinc.100}',
          activeColor: '{zinc.200}',
        },
      },
    },
  },
});

/** Selectable themes for the demo switcher. */
export const THEMES = [
  { id: 'lara-light-blue', label: 'Lara Light Blue', preset: laraColor('blue'), dark: false },
  { id: 'lara-light-indigo', label: 'Lara Light Indigo', preset: laraColor('indigo'), dark: false },
  { id: 'lara-light-purple', label: 'Lara Light Purple', preset: laraColor('purple'), dark: false },
  { id: 'aura-dark-noir', label: 'Aura Dark Noir', preset: AuraNoir, dark: true },
];

export const DEFAULT_THEME = THEMES[0];
