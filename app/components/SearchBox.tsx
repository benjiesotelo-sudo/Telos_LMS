'use client'

/**
 * A consistent search/filter input. Drop it above any client-rendered list and filter the
 * rows yourself with the `value`. Styled to match the existing Users-table search.
 */
export function SearchBox({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Search…'}
      aria-label={ariaLabel ?? placeholder ?? 'Search'}
      style={{
        width: '100%',
        maxWidth: 420,
        padding: '7px 10px',
        border: '1px solid var(--border)',
        borderRadius: 6,
        fontSize: 13,
        marginBottom: 14,
        boxSizing: 'border-box',
      }}
    />
  )
}
