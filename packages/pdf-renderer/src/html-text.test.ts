import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { htmlToPdfBlocks, htmlToPdfText, pdfBlocksHaveContent, pdfTextContent } from './html-text.js';

describe('htmlToPdfBlocks', () => {
  it('preserves bold text', () => {
    const blocks = htmlToPdfBlocks('<b>test</b>');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].parts[0].bold, true);
    assert.equal(blocks[0].parts[0].text, 'test');
  });

  it('maps headings to larger bold text blocks', () => {
    const blocks = htmlToPdfBlocks('<h1>Title</h1><p>Body</p>', { baseFontSize: 11.25 });
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].parts[0].bold, true);
    assert.equal(blocks[0].parts[0].fontSize, 18);
    assert.equal(blocks[0].parts[0].text, 'Title');
    assert.equal(blocks[1].parts[0], 'Body');
  });

  it('preserves center, left, and right alignment on div blocks', () => {
    const blocks = htmlToPdfBlocks(
      '<div style="text-align: center">Centered</div><div style="text-align: right">Right</div>',
    );
    assert.equal(blocks[0].alignment, 'center');
    assert.equal(blocks[1].alignment, 'right');
  });

  it('preserves alignment from document-align classes on div blocks', () => {
    const blocks = htmlToPdfBlocks(
      '<div class="document-align document-align--center">Centered</div>',
    );
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].alignment, 'center');
  });

  it('converts lists to bullet lines', () => {
    const blocks = htmlToPdfBlocks('<ul><li>one</li><li>two</li></ul>');
    assert.equal(blocks.length, 2);
    assert.match(String(blocks[0].parts[0]), /one/);
    assert.match(String(blocks[1].parts[0]), /two/);
  });

  it('converts bold, breaks, and list items to readable text', () => {
    const blocks = htmlToPdfBlocks('<b>test</b><br><ul><li>column 1</li></ul><br>');
    const text = pdfTextContent(htmlToPdfText('<b>test</b><br><ul><li>column 1</li></ul><br>'));
    assert.match(text, /test/);
    assert.match(text, /column 1/);
    assert.doesNotMatch(text, /<b>/);
    assert.ok(pdfBlocksHaveContent(blocks));
  });

  it('scales h2 relative to body pt size', () => {
    const blocks = htmlToPdfBlocks('<h2>Section</h2>', { baseFontSize: 11.25 });
    assert.equal(blocks[0].parts[0].fontSize, 15.2);
  });

  it('converts inline em font sizes using body px equivalent', () => {
    const blocks = htmlToPdfBlocks('<span style="font-size: 1.35em">Large</span>', {
      baseFontSize: 11.25,
    });
    assert.equal(blocks[0].parts[0].fontSize, 15.2);
  });

  it('returns no blocks for blank html', () => {
    assert.deepEqual(htmlToPdfBlocks('   '), []);
  });

  it('maps font-weight normal on spans to bold false', () => {
    const blocks = htmlToPdfBlocks('<span style="font-weight: normal">regular</span>');
    assert.equal(blocks[0].parts[0].bold, false);
  });

  it('resets bold inheritance when span sets font-weight normal inside b', () => {
    const blocks = htmlToPdfBlocks('<b>Label <span style="font-weight: normal">value</span></b>');
    const parts = blocks[0].parts;
    assert.equal(parts[0].bold, true);
    assert.equal(parts[1].bold, false);
    assert.match(String(parts[1].text ?? ''), /value/);
  });

  it('maps mark highlight to pdfmake background', () => {
    const blocks = htmlToPdfBlocks('before <mark>highlighted</mark> after');
    const part = blocks[0].parts.find((p) => typeof p === 'object' && String(p.text ?? '').includes('highlighted'));
    assert.equal(part?.background, '#FFF59D');
  });

  it('maps inline code to pdfmake background and smaller font size', () => {
    const blocks = htmlToPdfBlocks('<code>fn()</code>', { baseFontSize: 12 });
    assert.equal(blocks[0].parts[0].background, '#F0F0F0');
    assert.equal(blocks[0].parts[0].fontSize, 11);
    assert.equal(blocks[0].parts[0].text, 'fn()');
  });
});
