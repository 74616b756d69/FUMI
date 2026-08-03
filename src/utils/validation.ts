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
 * 郵便番号から都道府県を取得
 * @param code 郵便番号
 * @returns 都道府県名
 */
export function getPrefectureFromPostalCode(code: string): string | null {
  const normalized = normalizePostalCode(code)
  if (!normalized) return null

  const digits = normalized.replace('-', '')
  const firstThree = parseInt(digits.slice(0, 3), 10)

  // 郵便番号の最初の3桁で都道府県を判定（日本郵便の体系に基づく）
  if (firstThree >= 1 && firstThree <= 99) return '北海道'
  if (firstThree >= 100 && firstThree <= 139) return '青森県'
  if (firstThree >= 140 && firstThree <= 179) return '岩手県'
  if (firstThree >= 180 && firstThree <= 189) return '秋田県'
  if (firstThree >= 190 && firstThree <= 199) return '山形県'
  if (firstThree >= 200 && firstThree <= 249) return '福島県'
  if (firstThree >= 250 && firstThree <= 299) return '茨城県'
  if (firstThree >= 300 && firstThree <= 329) return '栃木県'
  if (firstThree >= 330 && firstThree <= 349) return '群馬県'
  if (firstThree >= 350 && firstThree <= 369) return '埼玉県'
  if (firstThree >= 370 && firstThree <= 399) return '千葉県'
  if (firstThree >= 400 && firstThree <= 499) return '東京都'
  if (firstThree >= 500 && firstThree <= 549) return '神奈川県'
  if (firstThree >= 550 && firstThree <= 599) return '新潟県'
  if (firstThree >= 600 && firstThree <= 629) return '富山県'
  if (firstThree >= 630 && firstThree <= 679) return '石川県'
  if (firstThree >= 680 && firstThree <= 699) return '福井県'
  if (firstThree >= 700 && firstThree <= 749) return '山梨県'
  if (firstThree >= 750 && firstThree <= 799) return '長野県'
  if (firstThree >= 800 && firstThree <= 829) return '岐阜県'
  if (firstThree >= 830 && firstThree <= 899) return '愛知県'
  if (firstThree >= 900 && firstThree <= 919) return '三重県'
  if (firstThree >= 920 && firstThree <= 949) return '滋賀県'
  if (firstThree >= 950 && firstThree <= 999) return '京都府'
  if (firstThree >= 1000 && firstThree <= 1099) return '大阪府'
  if (firstThree >= 1100 && firstThree <= 1149) return '兵庫県'
  if (firstThree >= 1150 && firstThree <= 1179) return '奈良県'
  if (firstThree >= 1180 && firstThree <= 1199) return '和歌山県'
  if (firstThree >= 1200 && firstThree <= 1249) return '鳥取県'
  if (firstThree >= 1250 && firstThree <= 1299) return '島根県'
  if (firstThree >= 1300 && firstThree <= 1349) return '岡山県'
  if (firstThree >= 1350 && firstThree <= 1399) return '広島県'
  if (firstThree >= 1400 && firstThree <= 1459) return '山口県'
  if (firstThree >= 1460 && firstThree <= 1499) return '香川県'
  if (firstThree >= 1500 && firstThree <= 1549) return '愛媛県'
  if (firstThree >= 1550 && firstThree <= 1599) return '高知県'
  if (firstThree >= 1600 && firstThree <= 1649) return '福岡県'
  if (firstThree >= 1650 && firstThree <= 1699) return '佐賀県'
  if (firstThree >= 1700 && firstThree <= 1799) return '長崎県'
  if (firstThree >= 1800 && firstThree <= 1899) return '熊本県'
  if (firstThree >= 1900 && firstThree <= 1949) return '大分県'
  if (firstThree >= 1950 && firstThree <= 1999) return '宮崎県'
  if (firstThree >= 2000 && firstThree <= 2099) return '鹿児島県'
  if (firstThree >= 2100 && firstThree <= 2199) return '沖縄県'

  return null
}

/**
 * zipcloud API を使って郵便番号から住所を検索
 */
export interface ZipcodeResult {
  zipcode: string
  prefecture: string
  city: string
  town: string
}

export async function searchAddressByZipcode(zipcode: string): Promise<ZipcodeResult | null> {
  try {
    const normalized = normalizePostalCode(zipcode)
    if (!normalized) return null

    const digits = normalized.replace('-', '')
    const url = `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 200 && data.results && data.results.length > 0) {
      const r = data.results[0]
      return {
        zipcode: r.zipcode,
        prefecture: r.address1,
        city: r.address2,
        town: r.address3
      }
    }

    return null
  } catch (error) {
    console.error('Zipcode search error:', error)
    return null
  }
}

/**
 * 複合バリデーション（全フィールド）
 */
export interface ValidationResult {
  isValid: boolean
  errors: {
    companyName?: string
    personName?: string
    postalCode?: string
    address?: string
    phone?: string
  }
}

/**
 * ハガキデータの全体バリデーション
 */
export function validatePostcardData(data: {
  companyName: string
  personName?: string
  postalCode: string
  address: string
  phone?: string
}): ValidationResult {
  const errors: ValidationResult['errors'] = {}

  if (!isValidName(data.companyName)) {
    errors.companyName = '企業名は1〜40文字で入力してください'
  }

  // 名前はオプション
  if (data.personName && !isValidName(data.personName)) {
    errors.personName = '名前は1〜40文字で入力してください'
  }

  if (!isValidPostalCode(data.postalCode)) {
    errors.postalCode = '郵便番号は XXX-XXXX 形式で入力してください'
  }

  if (!isValidAddress(data.address)) {
    errors.address = '住所は5〜200文字で入力してください'
  }

  if (!isValidPhone(data.phone)) {
    errors.phone = '電話番号の形式が正しくありません'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
