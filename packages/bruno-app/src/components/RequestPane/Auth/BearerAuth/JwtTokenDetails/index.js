import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconChevronDown, IconChevronRight, IconCopy } from '@tabler/icons';
import toast from 'react-hot-toast';
import useCopyToClipboard from 'hooks/useCopyToClipboard';
import { decodeJwtPayload, formatJwtClaimValue } from 'utils/jwt';
import StyledWrapper from './StyledWrapper';

const claimClipboardText = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value));

const JwtTokenDetails = ({ token }) => {
  const claims = useMemo(() => decodeJwtPayload(token), [token]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedClaim, setCopiedClaim] = useState(null);
  const copyResetTimeoutRef = useRef(null);
  const { copied, copyToClipboard } = useCopyToClipboard(2000);

  useEffect(() => {
    return () => clearTimeout(copyResetTimeoutRef.current);
  }, []);

  if (!claims) return null;

  const handleCopyClaim = async (key, value) => {
    try {
      await navigator.clipboard.writeText(claimClipboardText(value));
      setCopiedClaim(key);
      clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = setTimeout(() => setCopiedClaim(null), 1500);
    } catch {
      toast.error('Failed to copy value');
    }
  };

  return (
    <StyledWrapper className="mt-2 w-full">
      <div className="jwt-details">
        <div
          className="jwt-details-header"
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          <span>
            {isExpanded ? (
              <IconChevronDown size={16} className="text-gray-500" />
            ) : (
              <IconChevronRight size={16} className="text-gray-500" />
            )}
            Decoded JWT
          </span>
          <button
            type="button"
            className="jwt-copy-button"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(token);
            }}
            title="Copy token"
            aria-label="Copy token"
            data-testid="jwt-token-copy"
          >
            {copied ? (
              <IconCheck size={14} className="text-green-700" />
            ) : (
              <IconCopy size={14} className="text-gray-500" />
            )}
          </button>
        </div>
        {isExpanded && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <td>Claim</td>
                  <td>Value</td>
                </tr>
              </thead>
              <tbody>
                {Object.entries(claims).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td className="value">
                      <div className="jwt-claim-value group">
                        <span>{formatJwtClaimValue(key, value)}</span>
                        <button
                          type="button"
                          className="jwt-copy-button opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyClaim(key, value);
                          }}
                          title="Copy value"
                          aria-label={`Copy ${key}`}
                          data-testid="jwt-claim-copy"
                        >
                          {copiedClaim === key ? (
                            <IconCheck size={14} strokeWidth={2} className="text-green-700" />
                          ) : (
                            <IconCopy size={14} strokeWidth={1.5} className="text-gray-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default JwtTokenDetails;
