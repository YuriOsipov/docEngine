import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BROWSER_FONT_PRESETS } from './fonts-browser.js';
import { buildFontRegistry, primaryFontFamily } from './fonts-registry.js';

describe('primaryFontFamily', () => {
  it('extracts the first family from a CSS stack', () => {
    assert.equal(
      primaryFontFamily('Inter, ui-sans-serif, system-ui, sans-serif'),
      'inter',
    );
    assert.equal(primaryFontFamily('"Segoe UI", Tahoma, sans-serif'), 'segoe ui');
    assert.equal(primaryFontFamily('Roboto'), 'roboto');
  });
});

describe('buildFontRegistry resolveFontName', () => {
  const { resolveFontName } = buildFontRegistry(BROWSER_FONT_PRESETS, { preset: 'Roboto' });

  it('maps Inter CSS stack to Roboto', () => {
    assert.equal(
      resolveFontName("Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"),
      'Roboto',
    );
  });

  it('maps Roboto to Roboto when registered', () => {
    const robotoRegistry = buildFontRegistry(BROWSER_FONT_PRESETS, { preset: 'Roboto', defaultFont: 'Roboto' });
    assert.equal(robotoRegistry.resolveFontName('Roboto'), 'Roboto');
  });
});
