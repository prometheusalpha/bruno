import { getRequestFromCurlCommand } from './index';

describe('getRequestFromCurlCommand', () => {
  it('should treat --data-binary with inline JSON as a JSON body (not a file body)', () => {
    const curl = `curl -H "Content-Type: application/json; charset=UTF-8" --data-binary "{\\"pageUri\\":\\"/mobile-phones-store\\"}" "https://1.rome.api.flipkart.net/4/page/fetch"`;

    const request = getRequestFromCurlCommand(curl);

    expect(request.body.mode).toBe('json');
    expect(request.body.file).toBeNull();
    expect(JSON.parse(request.body.json)).toEqual({ pageUri: '/mobile-phones-store' });
  });

  it('should treat --data-binary with an @file reference as a file body', () => {
    const curl = `curl -H "Content-Type: application/octet-stream" --data-binary "@/path/to/payload.json" "https://example.com/upload"`;

    const request = getRequestFromCurlCommand(curl);

    expect(request.body.mode).toBe('file');
    expect(Array.isArray(request.body.file)).toBe(true);
    expect(request.body.file[0].filePath).toBe('/path/to/payload.json');
  });

  it('should import Basic auth from an Authorization header', () => {
    const encoded = Buffer.from('user:pass').toString('base64');
    const curl = `curl -H "Authorization: Basic ${encoded}" https://api.example.com/secure`;

    const request = getRequestFromCurlCommand(curl);

    expect(request.auth.mode).toBe('basic');
    expect(request.auth.basic).toEqual({ username: 'user', password: 'pass' });
    const headerNames = (request.headers || []).map((header) => header.name.toLowerCase());
    expect(headerNames).not.toContain('authorization');
  });
});
