import './style.css'
import { AppState, PostcardData, PostcardTemplate } from './types'
import { parseCSV, objectsToCSV } from './utils/csv'
import { toJapaneseEra, toKanjiNumber } from './utils/kanji'
import { storage } from './services/storage'
import { validatePostcardData, normalizePostalCode, searchAddressByZipcode } from './utils/validation'

/**
 * アプリケーションメインファイル
 * 状態管理・イベントバインド・画面描画を担当
 */

// アプリケーション状態
const state: AppState = {
  postcards: [],
  template: {
    id: 'default',
    name: 'デフォルトテンプレート',
    layout: 'vertical',
    backgroundColor: '#ffffff',
    textColor: '#000000'
  },
  selectedIds: new Set(),
  isLoading: false,
  currentPage: 1,
  pageSize: 6,
  filterQuery: '',
  showForm: false,
  editingId: undefined
}

/**
 * DOMエレメントの取得
 */
function getElement(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Element with id "${id}" not found`)
  return el
}

/**
 * アプリケーション初期化
 */
async function initApp(): Promise<void> {
  try {
    await storage.init()
    const allCards = await storage.getAll()
    state.postcards = allCards
  } catch (error) {
    console.error('Failed to initialize storage:', error)
  }

  const app = getElement('app')
  app.innerHTML = renderMainUI()
  bindEvents()
}

/**
 * メインUI HTML生成
 */
function renderMainUI(): string {
  const filteredCards = getFilteredCards()
  const totalPages = Math.ceil(filteredCards.length / state.pageSize)
  const paginatedCards = filteredCards.slice(
    (state.currentPage - 1) * state.pageSize,
    state.currentPage * state.pageSize
  )

  return `
    <div class="app bg-gray-50 min-h-screen">
      <header class="w-full bg-blue-50 shadow-sm border-b border-blue-200 no-print">
        <div class="max-w-6xl mx-auto px-6 py-6">
          <h1 class="text-3xl font-bold text-blue-900 mb-2">ハガキ印刷システム</h1>
          <p class="text-blue-700">Vite + TypeScript + Tailwind CSS</p>
        </div>
      </header>

      <main class="w-full max-w-6xl mx-auto px-6 py-8">
        <!-- コントロールパネル -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8 no-print">
          <h2 class="text-xl font-bold text-slate-800 mb-6">データ管理</h2>

          <div class="space-y-4">
            <!-- ファイルアップロード -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">
                  CSVファイルをアップロード
                </label>
                <input
                  type="file"
                  id="csvFile"
                  accept=".csv"
                  class="input-field"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">
                  検索
                </label>
                <input
                  type="text"
                  id="searchInput"
                  placeholder="名前、住所などで検索..."
                  class="input-field"
                />
              </div>
            </div>

            <!-- ボタングループ -->
            <div class="flex flex-wrap gap-2">
              <button id="uploadBtn" class="button-primary">
                アップロード
              </button>
              <button id="toggleFormBtn" class="button-secondary">
                + 手動登録
              </button>
              <button id="exportBtn" class="button-secondary" ${state.postcards.length === 0 ? 'disabled' : ''}>
                エクスポート
              </button>
              <button id="printBtn" class="button-secondary" ${state.postcards.length === 0 ? 'disabled' : ''}>
                印刷
              </button>
              <button id="deleteAllBtn" class="button-secondary text-red-600 hover:bg-red-100" ${state.postcards.length === 0 ? 'disabled' : ''}>
                全削除
              </button>
            </div>

            <!-- 統計情報 -->
            <div class="pt-4 border-t border-slate-200 text-sm text-slate-600">
              <p>合計: <strong>${state.postcards.length}</strong> 件 | 表示中: <strong>${paginatedCards.length}</strong> 件</p>
            </div>
          </div>
        </div>

        <!-- 手動登録フォーム -->
        ${state.showForm ? renderFormPanel() : ''}

        <!-- グリッド表示 -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 class="text-xl font-bold text-slate-800 mb-6 no-print">プレビュー</h2>
          <div id="previewContainer" class="space-y-8">
            ${paginatedCards.length > 0
              ? renderPostcardGrid(paginatedCards)
              : '<p class="text-slate-500 text-center w-full py-12">データがありません</p>'
            }
          </div>
        </div>

        <!-- ページネーション -->
        ${state.postcards.length > 0 ? renderPagination(totalPages) : ''}
      </main>

      <footer class="w-full bg-slate-100 border-t border-slate-200 mt-12 no-print">
        <div class="max-w-6xl mx-auto px-6 py-4 text-center text-sm text-slate-600">
          <p>&copy; 2024 ハガキ印刷システム. All rights reserved.</p>
        </div>
      </footer>
    </div>
  `
}

/**
 * フィルター適用
 */
function getFilteredCards(): PostcardData[] {
  if (!state.filterQuery) return state.postcards

  const query = state.filterQuery.toLowerCase()
  return state.postcards.filter(card =>
    card.companyName.toLowerCase().includes(query) ||
    card.personName?.toLowerCase().includes(query) ||
    card.address.toLowerCase().includes(query) ||
    card.postalCode?.includes(state.filterQuery) ||
    card.memo?.toLowerCase().includes(query)
  )
}

/**
 * グリッド表示
 */
function renderPostcardGrid(postcards: PostcardData[]): string {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${postcards.map(postcard => renderPostcardCard(postcard)).join('')}
    </div>
  `
}

/**
 * ハガキカード（プレビュー＋操作）
 */
function renderPostcardCard(postcard: PostcardData): string {
  return `
    <div class="flex flex-col">
      ${renderPostcardPreview(postcard)}
      <div class="bg-slate-50 border border-t-0 border-slate-200 rounded-b px-4 py-3 no-print space-y-2">
        <div class="flex gap-2">
          <button class="edit-btn flex-1 text-sm px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" data-id="${postcard.id}">
            編集
          </button>
          <button class="delete-btn flex-1 text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" data-id="${postcard.id}">
            削除
          </button>
        </div>
        <div class="text-xs text-slate-500">
          登録: ${new Date(postcard.createdAt).toLocaleDateString('ja-JP')}
        </div>
      </div>
    </div>
  `
}

/**
 * ページネーション UI
 */
function renderPagination(totalPages: number): string {
  if (totalPages <= 1) return ''

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i)
  }

  return `
    <div class="bg-white rounded-lg shadow-md p-6 no-print">
      <div class="flex items-center justify-center gap-2 flex-wrap">
        <button id="prevBtn" class="button-secondary" ${state.currentPage === 1 ? 'disabled' : ''}>
          ← 前へ
        </button>
        <div class="flex gap-1">
          ${pages.map(page => `
            <button class="page-btn px-3 py-2 rounded ${page === state.currentPage
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 hover:bg-slate-300'}" data-page="${page}">
              ${page}
            </button>
          `).join('')}
        </div>
        <button id="nextBtn" class="button-secondary" ${state.currentPage === totalPages ? 'disabled' : ''}>
          次へ →
        </button>
      </div>
    </div>
  `
}

/**
 * 手動登録フォーム
 */
function renderFormPanel(): string {
  const editing = state.editingId ? state.postcards.find(p => p.id === state.editingId) : null

  return `
    <div class="bg-blue-50 rounded-lg shadow-md p-6 mb-8 border-2 border-blue-200 no-print">
      <h3 class="text-lg font-bold text-blue-900 mb-4">
        ${editing ? 'ハガキを編集' : '新しいハガキを追加'}
      </h3>

      <form id="postcardForm" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              企業名 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="formCompanyName"
              class="input-field"
              value="${editing?.companyName || ''}"
              required
            />
            <p class="text-xs text-slate-500 mt-1">1〜40文字</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              担当者名
            </label>
            <input
              type="text"
              id="formPersonName"
              class="input-field"
              value="${editing?.personName || ''}"
            />
            <p class="text-xs text-slate-500 mt-1">オプション</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              郵便番号 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="formPostalCode"
              class="input-field"
              placeholder="000-0000"
              value="${editing?.postalCode || ''}"
              required
            />
            <p class="text-xs text-slate-500 mt-1">XXX-XXXX形式（自動検索）</p>
            <div id="prefectureInfo" class="text-xs text-blue-600 mt-1"></div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              電話番号
            </label>
            <input
              type="text"
              id="formPhone"
              class="input-field"
              value="${editing?.phone || ''}"
            />
            <p class="text-xs text-slate-500 mt-1">オプション</p>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            住所 <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="formAddress"
            class="input-field"
            value="${editing?.address || ''}"
            required
          />
          <p class="text-xs text-slate-500 mt-1">5〜200文字</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            備考
          </label>
          <input
            type="text"
            id="formMemo"
            class="input-field"
            placeholder="メモ（オプション）"
            value="${editing?.memo || ''}"
          />
          <p class="text-xs text-slate-500 mt-1">オプション</p>
        </div>

        <div class="flex gap-2 pt-4">
          <button type="submit" class="button-primary flex-1">
            ${editing ? '更新' : '追加'}
          </button>
          <button type="button" id="cancelFormBtn" class="button-secondary">
            キャンセル
          </button>
        </div>
      </form>
    </div>
  `
}

/**
 * ハガキプレビューのHTML生成
 */
function renderPostcardPreview(postcard: PostcardData): string {
  const year = new Date().getFullYear()
  const japaneseYear = toJapaneseEra(year)
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(postcard.address)}`

  return `
    <div class="postcard-base flex flex-col justify-between" style="background-color: ${state.template.backgroundColor}; color: ${state.template.textColor}">
      <!-- ハガキ上部 -->
      <div class="pb-4">
        <div class="text-center mb-4">
          <p class="text-sm font-bold">${japaneseYear}</p>
        </div>
        <div class="text-center">
          <p class="text-xs mb-2">新年のお喜びを申し上げます</p>
        </div>
      </div>

      <!-- ハガキ下部：住所など -->
      <div class="border-t pt-3">
        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p class="font-bold mb-1">〒 ${postcard.postalCode || '000-0000'}</p>
            <p>
              <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                ${postcard.address}
              </a>
            </p>
          </div>
          <div class="text-right">
            <p class="font-bold text-xs">${postcard.companyName}</p>
            <p class="font-bold">${postcard.personName}</p>
            <p class="text-xs">${postcard.phone || ''}</p>
          </div>
        </div>
      </div>
    </div>
  `
}

/**
 * イベントバインド
 */
function bindEvents(): void {
  // ファイルアップロード
  const uploadBtn = getElement('uploadBtn')
  const csvFile = getElement('csvFile') as HTMLInputElement
  uploadBtn.addEventListener('click', handleCSVUpload)
  csvFile.addEventListener('change', () => {
    uploadBtn.disabled = !csvFile.files?.length
  })

  // フォーム制御
  const toggleFormBtn = getElement('toggleFormBtn')
  toggleFormBtn.addEventListener('click', () => {
    state.showForm = !state.showForm
    state.editingId = undefined
    render()
  })

  // 検索
  const searchInput = getElement('searchInput') as HTMLInputElement
  searchInput.addEventListener('input', (e) => {
    state.filterQuery = (e.target as HTMLInputElement).value
    state.currentPage = 1
    render()
  })

  // ページネーション
  const prevBtn = document.getElementById('prevBtn')
  const nextBtn = document.getElementById('nextBtn')
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--
        render()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const filteredCards = getFilteredCards()
      const totalPages = Math.ceil(filteredCards.length / state.pageSize)
      if (state.currentPage < totalPages) {
        state.currentPage++
        render()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  const pageButtons = document.querySelectorAll('.page-btn')
  pageButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.currentPage = parseInt((e.target as HTMLElement).getAttribute('data-page') || '1', 10)
      render()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })

  // ハガキ編集・削除
  const editButtons = document.querySelectorAll('.edit-btn')
  const deleteButtons = document.querySelectorAll('.delete-btn')

  editButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).getAttribute('data-id')
      if (id) {
        state.editingId = id
        state.showForm = true
        render()
        document.getElementById('formName')?.focus()
      }
    })
  })

  deleteButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).getAttribute('data-id')
      if (id && confirm('このハガキを削除しますか？')) {
        handleDelete(id)
      }
    })
  })

  // フォーム送信
  const form = document.getElementById('postcardForm') as HTMLFormElement
  if (form) {
    form.addEventListener('submit', handleFormSubmit)
  }

  // 郵便番号の自動フォーマットと検索
  const postalCodeInput = document.getElementById('formPostalCode') as HTMLInputElement
  if (postalCodeInput) {
    postalCodeInput.addEventListener('input', async (e) => {
      const input = e.target as HTMLInputElement
      const prefInfo = document.getElementById('prefectureInfo')

      // 全角数字を半角に変換
      let value = input.value
        .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/\D/g, '')

      if (value.length > 7) {
        value = value.slice(0, 7)
      }

      // 入力がない場合はメッセージをクリア
      if (value.length === 0) {
        input.value = ''
        if (prefInfo) prefInfo.textContent = ''
        return
      }

      // 3文字以上で自動的にハイフンを挿入
      if (value.length >= 3) {
        const formatted = `${value.slice(0, 3)}-${value.slice(3)}`
        input.value = formatted

        // 7文字完成したら検索
        if (value.length === 7) {
          await handlePostalCodeSearch(formatted)
        } else {
          // 7文字未満の場合はメッセージをクリア（入力途中）
          if (prefInfo) prefInfo.textContent = ''
        }
      } else {
        input.value = value
        if (prefInfo) prefInfo.textContent = ''
      }
    })
  }

  const cancelFormBtn = document.getElementById('cancelFormBtn')
  if (cancelFormBtn) {
    cancelFormBtn.addEventListener('click', () => {
      state.showForm = false
      state.editingId = undefined
      render()
    })
  }

  // エクスポート・削除・印刷
  const exportBtn = getElement('exportBtn')
  const deleteAllBtn = getElement('deleteAllBtn')
  const printBtn = getElement('printBtn')

  exportBtn.addEventListener('click', handleExport)
  deleteAllBtn.addEventListener('click', handleDeleteAll)
  printBtn.addEventListener('click', handlePrint)
}

/**
 * CSVアップロード処理
 */
async function handleCSVUpload(): Promise<void> {
  const csvFile = getElement('csvFile') as HTMLInputElement
  const file = csvFile.files?.[0]

  if (!file) {
    alert('ファイルを選択してください')
    return
  }

  try {
    state.isLoading = true
    const text = await file.text()
    const data = parseCSV(text)

    // パースしたデータをPostcardData型に変換
    const newCards = data.map((row) => ({
      companyName: row.companyName || row.企業名 || '',
      personName: row.personName || row.担当者名 || '',
      address: row.address || row.住所 || '',
      memo: row.memo || row.備考 || '',
      postalCode: normalizePostalCode(row.postalCode || row.郵便番号 || '') || '',
      phone: row.phone || row.電話番号 || '',
      createdAt: Date.now()
    }))

    // ストレージに一括挿入
    await storage.bulkInsert(newCards)
    const allCards = await storage.getAll()
    state.postcards = allCards
    state.currentPage = 1
    state.filterQuery = ''

    alert(`${newCards.length}件のハガキデータを追加しました`)
    csvFile.value = ''
    render()
  } catch (error) {
    console.error('CSVパース処理でエラーが発生しました:', error)
    alert('CSVファイルの処理に失敗しました')
  } finally {
    state.isLoading = false
  }
}

/**
 * フォーム送信処理
 */
async function handleFormSubmit(e: Event): Promise<void> {
  e.preventDefault()

  const companyName = (document.getElementById('formCompanyName') as HTMLInputElement).value.trim()
  const personName = (document.getElementById('formPersonName') as HTMLInputElement).value.trim()
  const postalCode = (document.getElementById('formPostalCode') as HTMLInputElement).value.trim()
  const address = (document.getElementById('formAddress') as HTMLInputElement).value.trim()
  const memo = (document.getElementById('formMemo') as HTMLInputElement).value.trim()
  const phone = (document.getElementById('formPhone') as HTMLInputElement).value.trim()

  // バリデーション
  const validation = validatePostcardData({
    companyName,
    personName: personName || undefined,
    postalCode,
    address,
    phone: phone || undefined
  })

  if (!validation.isValid) {
    const errors = Object.values(validation.errors).filter(Boolean).join('\n')
    if (errors) {
      alert(`入力エラー:\n${errors}`)
      return
    }
  }

  try {
    state.isLoading = true
    const normalized = normalizePostalCode(postalCode) || postalCode

    if (state.editingId) {
      // 更新
      await storage.update(state.editingId, {
        companyName,
        personName: personName || undefined,
        postalCode: normalized,
        address,
        memo,
        phone: phone || undefined
      })
    } else {
      // 新規追加
      await storage.add({
        companyName,
        personName: personName || undefined,
        postalCode: normalized,
        address,
        memo,
        phone: phone || undefined,
        createdAt: Date.now()
      })
    }

    const allCards = await storage.getAll()
    state.postcards = allCards
    state.showForm = false
    state.editingId = undefined
    state.currentPage = 1

    render()
  } catch (error) {
    console.error('フォーム処理でエラーが発生しました:', error)
    alert('処理に失敗しました')
  } finally {
    state.isLoading = false
  }
}

/**
 * ハガキ削除
 */
async function handleDelete(id: string): Promise<void> {
  try {
    state.isLoading = true
    await storage.delete(id)
    const allCards = await storage.getAll()
    state.postcards = allCards

    if (state.postcards.length === 0) {
      state.currentPage = 1
    } else {
      const filteredCards = getFilteredCards()
      const totalPages = Math.ceil(filteredCards.length / state.pageSize)
      if (state.currentPage > totalPages) {
        state.currentPage = Math.max(1, totalPages)
      }
    }

    render()
  } catch (error) {
    console.error('削除処理でエラーが発生しました:', error)
    alert('削除に失敗しました')
  } finally {
    state.isLoading = false
  }
}

/**
 * 全削除
 */
async function handleDeleteAll(): Promise<void> {
  if (!confirm('すべてのハガキを削除しますか？この操作は取り消せません。')) {
    return
  }

  try {
    state.isLoading = true
    await storage.clear()
    state.postcards = []
    state.currentPage = 1
    state.filterQuery = ''
    render()
  } catch (error) {
    console.error('全削除処理でエラーが発生しました:', error)
    alert('削除に失敗しました')
  } finally {
    state.isLoading = false
  }
}

/**
 * CSVエクスポート
 */
async function handleExport(): Promise<void> {
  try {
    const data = state.postcards.map(card => ({
      '企業名': card.companyName,
      '担当者名': card.personName || '',
      '郵便番号': card.postalCode || '',
      '住所': card.address,
      '備考': card.memo || '',
      '電話番号': card.phone || '',
      '登録日': new Date(card.createdAt).toLocaleDateString('ja-JP')
    }))

    const csv = objectsToCSV(data)
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.href = url
    link.download = `postcards-${Date.now()}.csv`
    link.click()

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('エクスポート処理でエラーが発生しました:', error)
    alert('エクスポートに失敗しました')
  }
}

/**
 * 印刷処理
 */
function handlePrint(): void {
  window.print()
}

/**
 * 郵便番号の自動検索（zipcloud API使用）
 */
async function handlePostalCodeSearch(postalCode: string): Promise<void> {
  const prefInfo = document.getElementById('prefectureInfo')
  const addressInput = document.getElementById('formAddress') as HTMLInputElement

  try {
    const result = await searchAddressByZipcode(postalCode)

    if (prefInfo) {
      if (result) {
        prefInfo.textContent = `✓ ${result.prefecture}が確認されました`

        // 住所フィールドに都道府県・市区町村・町名を自動入力
        if (addressInput && addressInput.value.trim() === '') {
          const fullAddress = `${result.prefecture}${result.city}${result.town}`
          addressInput.value = fullAddress
        }
      } else {
        prefInfo.textContent = '郵便番号を確認してください'
      }
    }
  } catch (error) {
    console.error('郵便番号検索エラー:', error)
    if (prefInfo) {
      prefInfo.textContent = '郵便番号を確認してください'
    }
  }
}

/**
 * UI再描画
 */
function render(): void {
  const app = getElement('app')
  app.innerHTML = renderMainUI()
  bindEvents()
}

/**
 * アプリケーション起動
 */
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(error => {
    console.error('Failed to initialize app:', error)
  })
})

// HMRサポート（Vite開発サーバー用）
if (import.meta.hot) {
  import.meta.hot.accept()
}
