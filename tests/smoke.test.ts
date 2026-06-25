import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2)
  })

  it('points at the LOCAL supabase stack, never the cloud project', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toContain('127.0.0.1')
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).not.toContain(
      'dprrunxkmsavqmbuzkwf'
    )
  })
})
