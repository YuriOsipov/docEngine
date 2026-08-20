import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPreviewHtmlStylesheet, resolvePreviewHtmlCssVars } from './preview-html-styles.js';

describe('preview-html-styles', () => {
  it('emits CSS variables from page setup text style', () => {
    const vars = resolvePreviewHtmlCssVars({
      pageSetup: { textStyle: { fontFamily: 'Georgia, serif', fontSize: '18px' } },
    });
    assert.equal(vars['--me-document-font-family'], 'Georgia, serif');
    assert.equal(vars['--me-document-font-size'], '18px');
  });

  it('includes preview and table selectors for standalone export', () => {
    const css = buildPreviewHtmlStylesheet({});
    assert.match(css, /\.preview-document\s*\{/);
    assert.match(css, /\.document-section__header\s*\{/);
    assert.match(css, /\.document-section--border-top/);
    assert.match(css, /\.vision-table\s*,/);
    assert.match(css, /white-space:\s*normal/);
    assert.doesNotMatch(css, /<\/style/i);
  });

  it('keeps </style> out of the stylesheet when font values are hostile', () => {
    const css = buildPreviewHtmlStylesheet({
      pageSetup: { textStyle: { fontFamily: 'Arial</style><script>alert(1)</script>' } },
    });
    assert.doesNotMatch(css, /<\/style/i);
    assert.doesNotMatch(css, /<script/i);
  });
});
