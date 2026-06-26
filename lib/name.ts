export interface NameParts {
  prefix?: string; firstName: string; middleInitial?: string; lastName: string; suffix?: string
}
export function composeFullName(p: NameParts): string {
  const core = [p.prefix, p.firstName, p.middleInitial, p.lastName]
    .map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  const suffix = (p.suffix ?? '').trim()
  return suffix ? `${core}, ${suffix}` : core
}
