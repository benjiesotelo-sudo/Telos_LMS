import { execSync } from 'node:child_process'

function readEnv(): Record<string, string> {
  const out = execSync('supabase status -o env', { encoding: 'utf8' })
  const env: Record<string, string> = {}
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

export default function setup() {
  const env = readEnv()
  const url = env.API_URL
  if (!url || !url.includes('127.0.0.1')) {
    throw new Error(
      `Refusing to run tests: local Supabase API_URL must contain 127.0.0.1, got "${url}". Is the local stack up (supabase start)?`
    )
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.ANON_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY
  execSync('supabase db reset', { stdio: 'inherit' })
}
