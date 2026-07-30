import type { ButtonHTMLAttributes } from 'react'
import './RainbowButton.css'

export interface RainbowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function RainbowButton({
  children,
  className = '',
  type = 'button',
  ...props
}: RainbowButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={`rainbow-button${className ? ` ${className}` : ''}`}
      {...props}
    >
      <span className="rainbow-button__content">{children}</span>
    </button>
  )
}

export function GoogleIcon({ size = 17 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.55l3.34-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.94 5.45l3.34 2.62C7.19 7.7 9.4 5.94 12 5.94Z" />
    </svg>
  )
}
