import type * as React from 'react';

export const body: React.CSSProperties = {
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  backgroundColor: '#ffffff',
  color: '#111111',
};

export const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
};

export const h1: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 600,
  letterSpacing: '-0.5px',
  marginBottom: '16px',
  color: '#111111',
};

export const text: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: 1.5,
  color: '#374151',
  marginBottom: '12px',
};

export const textMuted: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.5,
  color: '#6b7280',
  marginTop: '24px',
};

export const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#111111',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '14px',
  marginTop: '8px',
  marginBottom: '8px',
};
