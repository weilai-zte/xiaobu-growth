export const FAMILY_ENTITIES: string[]
export function validateFamilyRecord(
  entity: string,
  row: object,
  old: object | undefined,
  get: (entity: string, id: string) => object | undefined,
  list: (entity: string) => object[],
): void
