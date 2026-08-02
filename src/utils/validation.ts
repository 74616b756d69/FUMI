/**
 * データ検証ユーティリティ
 */

/**
 * 郵便番号のバリデーション
 * @param code 郵便番号（XXX-XXXX形式または7桁の数字）
 * @returns 有効な郵便番号か
 */
export function isValidPostalCode(code: string): boolean {
  if (!code) return false
  
  // ハイフンあり: XXX-XXXX
  if (/^\d{3}-\d{4}$/.test(code)) {
    return true
  }
  
  // ハイフンなし: 7桁の数字
  if (/^\d{7}$/.test(code)) {
    return true
  }
  
  return false
}

/**
 * 郵便番号を正規化（XXX-XXXX形式に）
 * @param code 郵便番号
 * @returns 正規化された郵便番号、またはnull
 */
export function normalizePostalCode(code: string): string | null {
  if (!code) return null
  
  const digits = code.replace(/\D/g, '')
  
  if (digits.length !== 7) {
    return null
  }
  
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`
}

/**
 * 住所のバリデーション
 * @param address 住所文字列
 * @returns 有効な住所か
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false
  
  const trimmed = address.trim()
  
  // 最小5文字以上
  if (trimmed.length < 5) {
    return false
  }
  
  // 最大200文字以下
  if (trimmed.length > 200) {
    return false
  }
  
  return true
}

/**
 * 宛名のバリデーション
 * @param name 宛名
 * @returns 有効な宛名か
 */
export function isValidName(name: string): boolean {
  if (!name) return false
  
  const trimmed = name.trim()
  
  // 最小1文字以上
  if (trimmed.length < 1) {
    return false
  }
  
  // 最大40文字以下
  if (trimmed.length > 40) {
    return false
  }
  
  return true
}

/**
 * メッセージのバリデーション
 * @param message メッセージ
 * @returns 有効なメッセージか
 */
export function isValidMessage(message: string): boolean {
  if (!message) return false
  
  const trimmed = message.trim()
  
  // 最小1文字以上
  if (trimmed.length < 1) {
    return false
  }
  
  // 最大500文字以下
  if (trimmed.length > 500) {
    return false
  }
  
  return true
}

/**
 * 電話番号のバリデーション
 * @param phone 電話番号（オプション）
 * @returns 有効な電話番号か（空の場合もtrue）
 */
export function isValidPhone(phone?: string): boolean {
  if (!phone || phone.trim() === '') {
    return true // オプション項目なので空でもOK
  }
  
  // 数字とハイフン、括弧のみ
  if (!/^[\d\-()+ ]*$/.test(phone)) {
    return false
  }
  
  // 最小3文字以上（例：090...）
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 3) {
    return false
  }
  
  return true
}

/**
 * 郵便番号から都道府県コードを取得
 * @param code 郵便番号
 * @returns 都道府県コード
 */
export function getPrefectureFromPostalCode(code: string): string | null {
  const normalized = normalizePostalCode(code)
  if (!normalized) return null
  
  const prefix = parseInt(normalized.split('-')[0], 10)
  
  // 郵便番号の最初の2-3桁で都道府県を判定
  const prefectureMap: { [key: number]: string } = {
    1: '北海道',
    2: '青森県',
    3: '岩手県',
    4: '宮城県',
    5: '秋田県',
    6: '山形県',
    7: '福島県',
    8: '茨城県',
    9: '栃木県',
    10: '群馬県',
    11: '埼玉県',
    12: '千葉県',
    13: '東京都',
    14: '神奈川県',
    15: '新潟県',
    16: '富山県',
    17: '石川県',
    18: '福井県',
    19: '山梨県',
    20: '長野県',
    21: '岐阜県',
    22: '愛知県',
    23: '三重県',
    24: '滋賀県',
    25: '京都府',
    26: '大阪府',
    27: '兵庫県',
    28: '奈良県',
    29: '和歌山県',
    30: '鳥取県',
    31: '島根県',
    32: '岡山県',
    33: '広島県',
    34: '山口県',
    35: '徳島県',
    36: '香川県',
    37: '愛媛県',
    38: '高知県',
    39: '福岡県',
    40: '佐賀県',
    41: '長崎県',
    42: '熊本県',
    43: '大分県',
    44: '宮崎県',
    45: '鹿児島県',
    46: '沖縄県',
  }
  
  return prefectureMap[prefix] || null
}

/**
 * 複合バリデーション（全フィールド）
 */
export interface ValidationResult {
  isValid: boolean
  errors: {
    name?: string
    postalCode?: string
    address?: string
    message?: string
    phone?: string
  }
}

/**
 * ハガキデータの全体バリデーション
 */
export function validatePostcardData(data: {
  name: string
  postalCode: string
  address: string
  message: string
  phone?: string
}): ValidationResult {
  const errors: ValidationResult['errors'] = {}
  
  if (!isValidName(data.name)) {
    errors.name = '宛名は1〜40文字で入力してください'
  }
  
  if (!isValidPostalCode(data.postalCode)) {
    errors.postalCode = '郵便番号は XXX-XXXX 形式で入力してください'
  }
  
  if (!isValidAddress(data.address)) {
    errors.address = '住所は5〜200文字で入力してください'
  }
  
  if (!isValidMessage(data.message)) {
    errors.message = 'メッセージは1〜500文字で入力してください'
  }
  
  if (!isValidPhone(data.phone)) {
    errors.phone = '電話番号の形式が正しくありません'
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
