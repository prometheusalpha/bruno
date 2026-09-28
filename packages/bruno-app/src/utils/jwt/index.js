export const JWT_TIMESTAMP_CLAIMS = ['exp', 'iat', 'nbf'];

/**
 * Decodes the payload (second segment) of a JWT.
 * Returns null for anything that is not a decodable JWT — never throws.
 */
export const decodeJwtPayload = (token) => {
  if (typeof token !== 'string') return null;

  const trimmed = token.trim();
  if (!trimmed) return null;

  // un-interpolated bru variable placeholder, not a literal token
  if (trimmed.includes('{{')) return null;

  const parts = trimmed.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const utf8 = decodeURIComponent(
      Array.from(binary)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const payload = JSON.parse(utf8);

    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;

    return payload;
  } catch {
    return null;
  }
};

/**
 * Formats epoch seconds as a local-time 'YYYY-MM-DD HH:mm:ss +HH:mm' string.
 */
export const formatJwtTimestamp = (epochSeconds) => {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds)) return null;

  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (value) => String(value).padStart(2, '0');
  // getTimezoneOffset is UTC - local, so flip it to get the local UTC offset
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes < 0 ? '-' : '+';
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetRemainder = pad(Math.abs(offsetMinutes) % 60);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())} ${offsetSign}${offsetHours}:${offsetRemainder}`;
};

export const formatJwtClaimValue = (key, value) => {
  if (JWT_TIMESTAMP_CLAIMS.includes(key)) {
    const formatted = formatJwtTimestamp(value);
    if (formatted !== null) return `${formatted} (${value})`;
  }

  if (value !== null && typeof value === 'object') return JSON.stringify(value);

  return String(value);
};
