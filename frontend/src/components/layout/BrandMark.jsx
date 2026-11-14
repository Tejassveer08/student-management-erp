import React from 'react';

/** Rounded "G" monogram with the lime dot — used on printed marksheets and receipts */
export default function BrandMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M21.5 11.2A7 7 0 1 0 23 17h-6.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.5" cy="25.5" r="3.5" fill="#b8f03a" />
    </svg>
  );
}
