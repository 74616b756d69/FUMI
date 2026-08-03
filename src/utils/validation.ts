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
 * 企業名のバリデーション
 * @param name 企業名
 * @returns 有効な企業名か
 */
export function isValidCompanyName(name: string): boolean {
  if (!name) return false

  const trimmed = name.trim()

  // 最小1文字以上、最大60文字以下
  if (trimmed.length < 1 || trimmed.length > 60) {
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

  // 最小1文字以上、最大50文字以下
  if (trimmed.length < 1 || trimmed.length > 50) {
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

  const digits = normalized.replace('-', '')
  const firstThree = parseInt(digits.slice(0, 3), 10)

  // 郵便番号の最初の3桁で都道府県を判定（日本郵便の体系に基づく）
  if ((firstThree >= 1 && firstThree <= 99)) return '北海道'
  if ((firstThree >= 100 && firstThree <= 139)) return '青森県'
  if ((firstThree >= 20 && firstThree <= 29)) return '岩手県'
  if ((firstThree >= 980 && firstThree <= 989)) return '宮城県'
  if ((firstThree >= 10 && firstThree <= 19)) return '秋田県'
  if ((firstThree >= 990 && firstThree <= 999)) return '山形県'
  if ((firstThree >= 960 && firstThree <= 979)) return '福島県'
  if ((firstThree >= 300 && firstThree <= 319)) return '茨城県'
  if ((firstThree >= 320 && firstThree <= 329)) return '栃木県'
  if ((firstThree >= 370 && firstThree <= 379)) return '群馬県'
  if ((firstThree >= 330 && firstThree <= 369)) return '埼玉県'
  if ((firstThree >= 260 && firstThree <= 299)) return '千葉県'
  if ((firstThree >= 100 && firstThree <= 199)) return '東京都'
  if ((firstThree >= 210 && firstThree <= 259)) return '神奈川県'
  if ((firstThree >= 950 && firstThree <= 959)) return '新潟県'
  if ((firstThree >= 930 && firstThree <= 939)) return '富山県'
  if ((firstThree >= 920 && firstThree <= 929)) return '石川県'
  if ((firstThree >= 910 && firstThree <= 919)) return '福井県'
  if ((firstThree >= 400 && firstThree <= 409)) return '山梨県'
  if ((firstThree >= 380 && firstThree <= 399)) return '長野県'
  if ((firstThree >= 500 && firstThree <= 509)) return '岐阜県'
  if ((firstThree >= 450 && firstThree <= 499)) return '愛知県'
  if ((firstThree >= 510 && firstThree <= 519)) return '三重県'
  if ((firstThree >= 520 && firstThree <= 529)) return '滋賀県'
  if ((firstThree >= 600 && firstThree <= 629)) return '京都府'
  if ((firstThree >= 530 && firstThree <= 599)) return '大阪府'
  if ((firstThree >= 650 && firstThree <= 679)) return '兵庫県'
  if ((firstThree >= 630 && firstThree <= 649)) return '奈良県'
  if ((firstThree >= 640 && firstThree <= 649)) return '和歌山県'
  if ((firstThree >= 680 && firstThree <= 689)) return '鳥取県'
  if ((firstThree >= 690 && firstThree <= 699)) return '島根県'
  if ((firstThree >= 700 && firstThree <= 709)) return '岡山県'
  if ((firstThree >= 730 && firstThree <= 749)) return '広島県'
  if ((firstThree >= 750 && firstThree <= 759)) return '山口県'
  if ((firstThree >= 770 && firstThree <= 779)) return '徳島県'
  if ((firstThree >= 760 && firstThree <= 769)) return '香川県'
  if ((firstThree >= 790 && firstThree <= 799)) return '愛媛県'
  if ((firstThree >= 780 && firstThree <= 789)) return '高知県'
  if ((firstThree >= 810 && firstThree <= 829)) return '福岡県'
  if ((firstThree >= 840 && firstThree <= 849)) return '佐賀県'
  if ((firstThree >= 850 && firstThree <= 859)) return '長崎県'
  if ((firstThree >= 860 && firstThree <= 879)) return '熊本県'
  if ((firstThree >= 870 && firstThree <= 879)) return '大分県'
  if ((firstThree >= 880 && firstThree <= 889)) return '宮崎県'
  if ((firstThree >= 890 && firstThree <= 899)) return '鹿児島県'
  if ((firstThree >= 900 && firstThree <= 909)) return '沖縄県'

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

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
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
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Zipcode search timeout')
      throw new Error('郵便番号検索がタイムアウトしました')
    }
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

  if (!isValidCompanyName(data.companyName)) {
    errors.companyName = '企業名は1〜60文字で入力してください'
  }

  if (data.personName && !isValidName(data.personName)) {
    errors.personName = '名前は1〜50文字で入力してください'
  }

  if (!isValidPostalCode(data.postalCode)) {
    errors.postalCode = '郵便番号は XXX-XXXX 形式で入力してください'
  }

  if (!isValidAddress(data.address)) {
    errors.address = '住所は5〜200文字で入力してください'
  }

  if (!isValidPhone(data.phone)) {
    errors.phone = '電話番号は数字・ハイフン・括弧・スペースのみで入力してください'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
