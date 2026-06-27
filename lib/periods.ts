// Academic-term periods for a class/section. Plain module (NOT 'use server')
// so it can be imported by BOTH server actions and client components — a
// 'use server' file may only export async server actions, never constants.
export const CLASS_PERIODS = [
  '1st Semester',
  '2nd Semester',
  'Midyear',
  'Special Course',
] as const

export type ClassPeriod = (typeof CLASS_PERIODS)[number]
