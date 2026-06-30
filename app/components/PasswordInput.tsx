'use client'
import { useId, useState } from 'react'

/**
 * A password <input> with a built-in Show/Hide toggle.
 *
 * Works controlled (pass value + onChange — e.g. the register form) OR uncontrolled
 * (pass only name — e.g. the login form that submits via a server action). The toggle
 * flips the input's type between 'password' and 'text'; the typed value is preserved
 * either way.
 *
 * NOTE: for a "confirm password" field, do NOT use this — that field should stay masked
 * so the user truly retypes it. Use a plain <input type="password"> there.
 */
export function PasswordInput({
  name,
  id,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  placeholder,
  className = 'feu-input',
}: {
  name?: string
  id?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  autoComplete?: string
  required?: boolean
  minLength?: number
  placeholder?: string
  className?: string
}) {
  const [show, setShow] = useState(false)
  const reactId = useId()
  const inputId = id ?? reactId

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={inputId}
        name={name}
        className={className}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        style={{ paddingRight: 64 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 28,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 10px',
          color: 'var(--feu-green, #1a7c4e)',
        }}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
