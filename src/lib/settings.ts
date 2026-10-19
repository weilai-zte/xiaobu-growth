export const SETTINGS_KEYS = {
  childView: 'ui.childView',
  pin: 'security.parentPin',
  lastBackupAt: 'data.lastBackupAt',
  lastImportAt: 'data.lastImportAt',
} as const

export interface PinSetting {
  enabled: boolean
  salt: string
  hash: string
}

export const DEFAULT_PIN_SETTING: PinSetting = { enabled: false, salt: '', hash: '' }

/** 只用于「防误触」的本地门锁，不是安全边界，也不做任何联网校验 */
export function makeSalt(): string {
  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hashPin(pin: string, salt: string): string {
  const input = `${salt}:${pin}:xiaobu-growth`
  let hash = 0x811c9dc5
  for (let round = 0; round < 64; round += 1) {
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i) + round
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return hash.toString(16).padStart(8, '0')
}
