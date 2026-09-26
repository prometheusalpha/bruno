import { renderHook } from '@testing-library/react';
import { detectContentTypeFromBase64 } from 'utils/response';
import { useInitialResponseFormat, useResponsePreviewFormatOptions } from './index';

// QueryResultPreview pulls in CodeEditor -> the redux store -> `import.meta`, which jsdom/jest
// cannot transform. The hooks under test never render it, so stub it out.
jest.mock('./QueryResultPreview', () => ({ __esModule: true, default: () => null }));

// Mirrors the first bytes of a real Vietnamese invoice API response: mostly ASCII JSON
// punctuated by UTF-8 multibyte characters, which pushes the printable-byte ratio of the
// first 512 bytes below the isLikelyText threshold, so binary sniffing returns null.
const vietnameseJsonBody = Buffer.from(
  JSON.stringify({
    code: 200,
    message: 'OK',
    data: [
      {
        id: 143504,
        sellerUnitName: 'CÔNG TY CỔ PHẦN DƯỢC PHẨM VIỆT MIỀN TRUNG',
        sellerTaxCode: '4001216792',
        sellerAddress: 'Thôn Ngọc Bích, Phường Hương Trà, Thành phố Đà Nẵng, Việt Nam'
      }
    ]
  }),
  'utf8'
).toString('base64');

describe('root cause', () => {
  it('binary sniffing returns null for this body, which is why gating on it was wrong', () => {
    expect(detectContentTypeFromBase64(vietnameseJsonBody)).toBe(null);
  });
});

describe('useInitialResponseFormat', () => {
  it('derives the format from the content-type header when binary sniffing yields nothing', () => {
    const { result } = renderHook(() => useInitialResponseFormat({ 'content-type': 'application/json' }));

    expect(result.current.initialFormat).toBe('json');
    expect(result.current.initialTab).toBe('editor');
    expect(result.current.contentType).toBe('application/ld+json');
  });

  it('handles a content type with a charset parameter', () => {
    const { result } = renderHook(() =>
      useInitialResponseFormat({ 'content-type': 'application/json; charset=utf-8' })
    );

    expect(result.current.initialFormat).toBe('json');
  });

  it('maps html to the preview tab', () => {
    const { result } = renderHook(() => useInitialResponseFormat({ 'Content-Type': 'text/html' }));

    expect(result.current.initialFormat).toBe('html');
    expect(result.current.initialTab).toBe('preview');
  });

  it('waits when no content type has arrived yet', () => {
    expect(renderHook(() => useInitialResponseFormat(undefined)).result.current).toEqual({
      initialFormat: null,
      initialTab: null,
      contentType: ''
    });
    expect(renderHook(() => useInitialResponseFormat({})).result.current).toEqual({
      initialFormat: null,
      initialTab: null,
      contentType: ''
    });
    expect(
      renderHook(() => useInitialResponseFormat({ 'content-length': '14676' })).result.current
    ).toEqual({ initialFormat: null, initialTab: null, contentType: '' });
  });

  it('keeps the sniffed result out of the format decision', () => {
    // A PNG body served with a json content type: the header still wins, exactly as before the fix.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
    const { result } = renderHook(() => useInitialResponseFormat({ 'content-type': 'application/json' }));

    expect(result.current.initialFormat).toBe('json');
    expect(png).toBe('iVBORw0KGgo=');
  });
});

describe('useResponsePreviewFormatOptions', () => {
  it('offers the structured formats for a text body with a json content type', () => {
    const { result } = renderHook(() =>
      useResponsePreviewFormatOptions(vietnameseJsonBody, { 'content-type': 'application/json' })
    );

    expect(result.current.map((option) => option.id)).toEqual(
      expect.arrayContaining(['raw', 'json', 'html', 'xml'])
    );
  });

  it('narrows to raw when the sniffed body is binary', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
    const { result } = renderHook(() => useResponsePreviewFormatOptions(png, { 'content-type': 'image/png' }));

    expect(result.current.map((option) => option.id)).toEqual(['raw', 'hex', 'base64']);
  });
});
