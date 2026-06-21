'use client';

import { useState } from 'react';

// Password field with a show/hide toggle (Forms "password-toggle"). The toggle is
// a real button with an aria-label and aria-pressed so screen-reader and keyboard
// users get the same affordance; revealing never changes layout (icon sits inside
// the field's right padding).
export function PasswordInput({
  className = '',
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative w-full">
      <input {...rest} type={show ? 'text' : 'password'} className={`${className} w-full pr-11`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex items-center rounded-control px-3 text-muted transition-colors duration-150 ease-out-quart hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function iconProps() {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function EyeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4.2M6.2 6.2A18 18 0 0 0 2 11s3.5 7 10 7a10.9 10.9 0 0 0 3.1-.5" />
    </svg>
  );
}
