type MapDef = Record<string, string>

const bidiMaps: Record<string, MapDef> = {
  QDirection: { Equipment: 'E', Host: 'H', Both: 'B' },
  QPattern: { Fixed: 'F', Flexible: 'V' },
  QValueLinkMode: { Part: 'P', Full: 'F' },
  QMessageLogMode: { Detail: 'D', Short: 'S' },
  QOperationFlowLogMode: { UnifiedSimple: 'U', UnifiedComplex: 'C', Isolated: 'I' },
  QPlcPerformType: { Read: 'R', Write: 'W' },
  QDeliveryType: {
    Request: 'R',
    Reply: 'RP',
    Mulitcast: 'M',
    GuaranteedUnicast: 'GU',
    GuaranteedMulticast: 'GM',
    Unicast: 'U',
  },
  QDriverType: {
    SECS: 'S',
    HOST: 'H',
    OPC: 'O',
    PLC: 'P',
    MODBUS: 'M',
    COGNEX: 'G',
    CUSTOM: 'C',
  },
  QFormat: {
    List: 'L',
    AsciiList: 'AL',
    Binary: 'B',
    Boolean: 'BL',
    Char: 'C',
    Ascii: 'A',
    JIS8: 'J8',
    A2: 'A2',
    I8: 'I8',
    I4: 'I4',
    I2: 'I2',
    I1: 'I1',
    F8: 'F8',
    F4: 'F4',
    U8: 'U8',
    U4: 'U4',
    U2: 'U2',
    U1: 'U1',
    Unknown: 'UN',
    Raw: 'R',
    KO: 'KO',
  },
  QSecsLengthBytes: { Auto: '0', Byte1: '1', Byte2: '2', Byte3: '3' },
}

// Helpers for numeric backed enums stored as numbers
function logLevelToStorage(name: string) {
  const m = /^Level(\d+)$/i.exec(name)
  if (m) return m[1]
  return name
}
function logLevelFromStorage(value: string) {
  if (/^\d+$/.test(value)) return `Level${value}`
  return value
}

export function enumToStorage(enumType: string, displayValue: string) {
  if (displayValue === undefined || displayValue === null) return ''
  const map = bidiMaps[enumType]
  if (map && map[displayValue] !== undefined) return map[displayValue]

  if (enumType === 'QLogLevel') return logLevelToStorage(displayValue)

  // Fallback: keep original
  return displayValue
}

export function enumFromStorage(enumType: string, storedValue: string) {
  if (storedValue === undefined || storedValue === null) return ''
  const map = bidiMaps[enumType]
  if (map) {
    const found = Object.entries(map).find(([, v]) => v === storedValue)
    if (found) return found[0]
  }

  if (enumType === 'QLogLevel') return logLevelFromStorage(storedValue)

  // No explicit mapping; return as-is
  return storedValue
}
