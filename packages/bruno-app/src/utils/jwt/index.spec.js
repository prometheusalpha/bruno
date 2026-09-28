const {
  decodeJwtPayload,
  formatJwtTimestamp,
  formatJwtClaimValue,
  JWT_TIMESTAMP_CLAIMS
} = require('./index');

const TOKEN
  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNzE2MjM5MDIyLCJleHAiOjE3MTYyMzk4MjIsImFkbWluIjp7InJvbGVzIjpbImFkbWluIl19LCJzY29wZSI6InJlYWQifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const PAYLOAD = {
  sub: '1234567890',
  name: 'John Doe',
  iat: 1716239022,
  exp: 1716239822,
  admin: { roles: ['admin'] },
  scope: 'read'
};

const localTimestamp = (epochSeconds) => {
  const date = new Date(epochSeconds * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes < 0 ? '-' : '+';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())} ${offsetSign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(
    Math.abs(offsetMinutes) % 60
  )}`;
};

describe('JWT_TIMESTAMP_CLAIMS', () => {
  it('lists the NumericDate claims', () => {
    expect(JWT_TIMESTAMP_CLAIMS).toEqual(['exp', 'iat', 'nbf']);
  });
});

describe('decodeJwtPayload', () => {
  it('decodes the payload of a real token', () => {
    expect(decodeJwtPayload(TOKEN)).toEqual(PAYLOAD);
  });

  it('decodes a base64url payload without padding', () => {
    const standard = Buffer.from(JSON.stringify(PAYLOAD)).toString('base64');
    const base64url = standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(base64url).not.toContain('=');
    const token = `header.${base64url}.signature`;

    expect(decodeJwtPayload(token)).toEqual(PAYLOAD);
  });

  it('returns null for non-token input', () => {
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('   ')).toBeNull();
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload(12345)).toBeNull();
  });

  it('returns null for un-interpolated variable placeholders', () => {
    expect(decodeJwtPayload('{{process.env.TOKEN}}')).toBeNull();
  });

  it('returns null when the payload is not decodable', () => {
    expect(decodeJwtPayload('header.!!!!.signature')).toBeNull();
    expect(decodeJwtPayload('header.bm90anNvbg.signature')).toBeNull();
  });

  it('returns null when the payload is not a plain object', () => {
    const arrayPayload = Buffer.from(JSON.stringify([1, 2, 3])).toString('base64url');
    expect(decodeJwtPayload(`header.${arrayPayload}.signature`)).toBeNull();

    const nullPayload = Buffer.from('null').toString('base64url');
    expect(decodeJwtPayload(`header.${nullPayload}.signature`)).toBeNull();
  });
});

describe('formatJwtTimestamp', () => {
  it('formats epoch seconds in local time', () => {
    expect(formatJwtTimestamp(1716239022)).toBe(localTimestamp(1716239022));
    expect(formatJwtTimestamp(0)).toBe(localTimestamp(0));
  });

  it('appends the local UTC offset', () => {
    expect(formatJwtTimestamp(1716239022)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}$/);
  });

  it('returns null for non-numeric or invalid input', () => {
    expect(formatJwtTimestamp('1716239022')).toBeNull();
    expect(formatJwtTimestamp(NaN)).toBeNull();
    expect(formatJwtTimestamp(Infinity)).toBeNull();
    expect(formatJwtTimestamp(null)).toBeNull();
  });
});

describe('formatJwtClaimValue', () => {
  it('appends the raw epoch for NumericDate claims', () => {
    const value = formatJwtClaimValue('exp', 1716239822);
    expect(value).toBe(`${localTimestamp(1716239822)} (1716239822)`);
    expect(formatJwtClaimValue('iat', 1716239022)).toBe(`${localTimestamp(1716239022)} (1716239022)`);
    expect(formatJwtClaimValue('nbf', 1716239022)).toBe(`${localTimestamp(1716239022)} (1716239022)`);
  });

  it('falls back to String for non-numeric timestamp claims', () => {
    expect(formatJwtClaimValue('exp', 'soon')).toBe('soon');
  });

  it('stringifies objects and arrays', () => {
    expect(formatJwtClaimValue('admin', { roles: ['admin'] })).toBe('{"roles":["admin"]}');
  });

  it('stringifies primitives', () => {
    expect(formatJwtClaimValue('sub', '1234567890')).toBe('1234567890');
    expect(formatJwtClaimValue('active', true)).toBe('true');
    expect(formatJwtClaimValue('active', null)).toBe('null');
  });
});
