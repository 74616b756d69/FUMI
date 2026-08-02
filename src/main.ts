import './style.css'
import { AppState, PostcardData, SenderInfo } from './types'
import { parseCSV, objectsToCSV } from './utils/csv'
import { toJapaneseEra } from './utils/kanji'
import { storage } from './services/storage'
import { validatePostcardData, normalizePostalCode, searchAddressByZipcode } from './utils/validation'

const SENDER_STORAGE_KEY = 'postcard-app-sender-info'

function loadSenderInfo(): SenderInfo {
  try {
    const saved = localStorage.getItem(SENDER_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { companyName: '', personName: '', postalCode: '', address: '', phone: '' }
}

function saveSenderInfo(info: SenderInfo): void {
  localStorage.setItem(SENDER_STORAGE_KEY, JSON.stringify(info))
}

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
  pageSize: 20,
  filterQuery: '',
  showForm: false,
  editingId: undefined,
  currentView: 'list',
  showSenderForm: false,
  senderInfo: loadSenderInfo()
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
        </div>
      </header>

      <main class="w-full max-w-6xl mx-auto px-6 py-8">
        <!-- コントロールパネル -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8 no-print">
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">CSVファイル</label>
                <input type="file" id="csvFile" accept=".csv" class="input-field" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">検索</label>
                <input type="text" id="searchInput" placeholder="名前、住所などで検索..." class="input-field" value="${state.filterQuery}" />
              </div>
              <div class="flex items-end">
                <button id="uploadBtn" class="button-primary w-full">アップロード</button>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button id="toggleFormBtn" class="button-secondary">+ 手動登録</button>
              <button id="exportBtn" class="button-secondary" ${state.postcards.length === 0 ? 'disabled' : ''}>エクスポート</button>
              <button id="senderInfoBtn" class="button-secondary">差出人設定</button>
              <button id="printBackBtn" class="button-primary" ${state.postcards.length === 0 ? 'disabled' : ''}>裏面印刷</button>
              <button id="deleteAllBtn" class="button-secondary text-red-600 hover:bg-red-100" ${state.postcards.length === 0 ? 'disabled' : ''}>全削除</button>
            </div>

            <div class="pt-4 border-t border-slate-200 text-sm text-slate-600">
              <p>合計: <strong>${state.postcards.length}</strong> 件 | 表示中: <strong>${paginatedCards.length}</strong> 件</p>
            </div>
          </div>
        </div>

        ${state.showSenderForm ? renderSenderForm() : ''}
        ${state.showForm ? renderFormPanel() : ''}

        <!-- 住所録一覧 -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8 no-print">
          <h2 class="text-xl font-bold text-slate-800 mb-6">住所録一覧</h2>
          ${paginatedCards.length > 0
            ? renderAddressTable(paginatedCards)
            : '<p class="text-slate-500 text-center py-12">データがありません。CSVファイルをアップロードするか、手動登録してください。</p>'
          }
        </div>

        ${state.postcards.length > 0 ? renderPagination(totalPages) : ''}
      </main>

      <!-- 印刷用裏面（非表示、印刷時のみ表示） -->
      <div id="printArea" class="print-only"></div>
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

function renderAddressTable(postcards: PostcardData[]): string {
  const startIndex = (state.currentPage - 1) * state.pageSize
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b-2 border-slate-200 text-left">
            <th class="py-3 px-2 w-10">#</th>
            <th class="py-3 px-2">企業名</th>
            <th class="py-3 px-2">名前</th>
            <th class="py-3 px-2">郵便番号</th>
            <th class="py-3 px-2">住所</th>
            <th class="py-3 px-2">電話番号</th>
            <th class="py-3 px-2">備考</th>
            <th class="py-3 px-2 w-24">操作</th>
          </tr>
        </thead>
        <tbody>
          ${postcards.map((card, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-2 text-slate-400">${startIndex + i + 1}</td>
              <td class="py-2 px-2 font-medium">${escapeHtml(card.companyName)}</td>
              <td class="py-2 px-2">${escapeHtml(card.personName || '')}</td>
              <td class="py-2 px-2 whitespace-nowrap">${escapeHtml(card.postalCode || '')}</td>
              <td class="py-2 px-2">${escapeHtml(card.address)}</td>
              <td class="py-2 px-2 whitespace-nowrap">${escapeHtml(card.phone || '')}</td>
              <td class="py-2 px-2 text-slate-500">${escapeHtml(card.memo || '')}</td>
              <td class="py-2 px-2">
                <div class="flex gap-1">
                  <button class="edit-btn text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" data-id="${card.id}">編集</button>
                  <button class="delete-btn text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" data-id="${card.id}">削除</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function renderSenderForm(): string {
  const s = state.senderInfo
  return `
    <div class="bg-green-50 rounded-lg shadow-md p-6 mb-8 border-2 border-green-200 no-print">
      <h3 class="text-lg font-bold text-green-900 mb-4">差出人情報（裏面に印刷されます）</h3>
      <form id="senderForm" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">企業名・氏名</label>
            <input type="text" id="senderCompanyName" class="input-field" value="${escapeAttr(s.companyName)}" placeholder="株式会社○○" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">名前</label>
            <input type="text" id="senderPersonName" class="input-field" value="${escapeAttr(s.personName)}" placeholder="山田 太郎" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">郵便番号</label>
            <input type="text" id="senderPostalCode" class="input-field" value="${escapeAttr(s.postalCode)}" placeholder="000-0000" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">電話番号</label>
            <input type="text" id="senderPhone" class="input-field" value="${escapeAttr(s.phone)}" placeholder="03-0000-0000" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">住所</label>
          <input type="text" id="senderAddress" class="input-field" value="${escapeAttr(s.address)}" placeholder="東京都○○区..." />
        </div>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="button-primary">保存</button>
          <button type="button" id="cancelSenderBtn" class="button-secondary">閉じる</button>
        </div>
      </form>
    </div>
  `
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
              名前
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
            <div class="relative">
              <input
                type="text"
                id="formPostalCode"
                class="input-field pr-10"
                inputmode="numeric"
                placeholder="000-0000"
                maxlength="8"
                value="${editing?.postalCode || ''}"
                required
              />
              <div id="postalCodeSpinner" class="absolute right-3 top-1/2 -translate-y-1/2 hidden">
                <svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
              <div id="postalCodeCheckmark" class="absolute right-3 top-1/2 -translate-y-1/2 hidden text-green-500 text-sm font-bold">✓</div>
            </div>
            <p class="text-xs text-slate-500 mt-1">数字7桁で住所を自動入力</p>
            <div id="prefectureInfo" class="text-xs mt-1"></div>
            <div id="addressSuggestion" class="hidden mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <p class="text-sm text-green-800 mb-2">
                <span class="font-medium">検索結果:</span> <span id="suggestedAddress"></span>
              </p>
              <div class="flex gap-2">
                <button type="button" id="applySuggestionBtn" class="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">住所に反映</button>
                <button type="button" id="dismissSuggestionBtn" class="text-xs px-3 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300">閉じる</button>
              </div>
            </div>
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

function renderPostcardBack(): string {
  const year = new Date().getFullYear()
  const nextYear = year + 1
  const japaneseYear = toJapaneseEra(nextYear)
  const s = state.senderInfo

  const hasSender = s.companyName || s.personName || s.address

  return `
    <div class="postcard-back">
      <div class="postcard-back-content">
        <div class="postcard-back-greeting">
          <p class="greeting-main">謹賀新年</p>
          <p class="greeting-sub">旧年中は格別のお引き立てを賜り<br>厚く御礼申し上げます</p>
          <p class="greeting-sub">本年も変わらぬご愛顧のほど<br>よろしくお願い申し上げます</p>
        </div>
        <div class="postcard-back-footer">
          <p class="greeting-year">${japaneseYear} 元旦</p>
          ${hasSender ? `
            <div class="sender-info">
              ${s.postalCode ? `<p class="sender-postal">〒${s.postalCode}</p>` : ''}
              ${s.address ? `<p class="sender-address">${escapeHtml(s.address)}</p>` : ''}
              ${s.companyName ? `<p class="sender-company">${escapeHtml(s.companyName)}</p>` : ''}
              ${s.personName ? `<p class="sender-person">${escapeHtml(s.personName)}</p>` : ''}
              ${s.phone ? `<p class="sender-phone">TEL: ${escapeHtml(s.phone)}</p>` : ''}
            </div>
          ` : ''}
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
  const uploadBtn = getElement('uploadBtn') as HTMLButtonElement
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
    postalCodeInput.addEventListener('input', async () => {
      handlePostalCodeInput(postalCodeInput)
    })

    postalCodeInput.addEventListener('keydown', (e) => {
      // ハイフンの直後でバックスペースを押した場合、ハイフンと前の数字を削除
      if (e.key === 'Backspace') {
        const pos = postalCodeInput.selectionStart ?? 0
        if (pos === 4 && postalCodeInput.value[3] === '-') {
          e.preventDefault()
          const digits = postalCodeInput.value.replace(/\D/g, '')
          const newDigits = digits.slice(0, 2)
          postalCodeInput.value = newDigits
          postalCodeInput.setSelectionRange(2, 2)
          resetPostalCodeUI()
        }
      }
    })

    postalCodeInput.addEventListener('paste', (e) => {
      e.preventDefault()
      const pasted = e.clipboardData?.getData('text') || ''
      const digits = pasted
        .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/\D/g, '')
        .slice(0, 7)

      if (digits.length >= 3) {
        postalCodeInput.value = `${digits.slice(0, 3)}-${digits.slice(3)}`
      } else {
        postalCodeInput.value = digits
      }

      if (digits.length === 7) {
        handlePostalCodeSearch(postalCodeInput.value)
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

  // 差出人設定
  const senderInfoBtn = document.getElementById('senderInfoBtn')
  if (senderInfoBtn) {
    senderInfoBtn.addEventListener('click', () => {
      state.showSenderForm = !state.showSenderForm
      render()
    })
  }

  const senderForm = document.getElementById('senderForm') as HTMLFormElement
  if (senderForm) {
    senderForm.addEventListener('submit', (e) => {
      e.preventDefault()
      state.senderInfo = {
        companyName: (document.getElementById('senderCompanyName') as HTMLInputElement).value.trim(),
        personName: (document.getElementById('senderPersonName') as HTMLInputElement).value.trim(),
        postalCode: (document.getElementById('senderPostalCode') as HTMLInputElement).value.trim(),
        address: (document.getElementById('senderAddress') as HTMLInputElement).value.trim(),
        phone: (document.getElementById('senderPhone') as HTMLInputElement).value.trim()
      }
      saveSenderInfo(state.senderInfo)
      state.showSenderForm = false
      render()
      alert('差出人情報を保存しました')
    })
  }

  const cancelSenderBtn = document.getElementById('cancelSenderBtn')
  if (cancelSenderBtn) {
    cancelSenderBtn.addEventListener('click', () => {
      state.showSenderForm = false
      render()
    })
  }

  // エクスポート・削除・裏面印刷
  const exportBtn = getElement('exportBtn')
  const deleteAllBtn = getElement('deleteAllBtn')
  const printBackBtn = document.getElementById('printBackBtn')

  exportBtn.addEventListener('click', handleExport)
  deleteAllBtn.addEventListener('click', handleDeleteAll)
  if (printBackBtn) {
    printBackBtn.addEventListener('click', handlePrintBack)
  }
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
      personName: row.personName || row.名前 || '',
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
      '名前': card.personName || '',
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

function handlePrintBack(): void {
  const printArea = document.getElementById('printArea')
  if (!printArea) return

  const count = state.postcards.length
  if (count === 0) {
    alert('印刷するデータがありません')
    return
  }

  const cards: string[] = []
  for (let i = 0; i < count; i++) {
    cards.push(renderPostcardBack())
  }
  printArea.innerHTML = cards.join('')

  requestAnimationFrame(() => {
    window.print()
  })
}

/**
 * 郵便番号入力のフォーマット処理
 */
function handlePostalCodeInput(input: HTMLInputElement): void {
  const cursorPos = input.selectionStart ?? 0

  // 全角数字を半角に変換し、数字以外を除去
  let digits = input.value
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/\D/g, '')

  if (digits.length > 7) {
    digits = digits.slice(0, 7)
  }

  if (digits.length === 0) {
    input.value = ''
    resetPostalCodeUI()
    return
  }

  // フォーマット適用
  let formatted: string
  if (digits.length >= 3) {
    formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`
  } else {
    formatted = digits
  }

  // カーソル位置を計算（ハイフン挿入分を補正）
  const oldValue = input.value
  input.value = formatted

  let newCursorPos = cursorPos
  if (oldValue.length < formatted.length && cursorPos >= 3 && digits.length >= 3) {
    // ハイフンが挿入された場合、カーソルをその分進める
    if (!oldValue.includes('-') && formatted.includes('-')) {
      newCursorPos = cursorPos + 1
    }
  }
  newCursorPos = Math.min(newCursorPos, formatted.length)
  input.setSelectionRange(newCursorPos, newCursorPos)

  if (digits.length === 7) {
    handlePostalCodeSearch(formatted)
  } else {
    resetPostalCodeUI()
  }
}

/**
 * 郵便番号UIをリセット
 */
function resetPostalCodeUI(): void {
  const prefInfo = document.getElementById('prefectureInfo')
  const spinner = document.getElementById('postalCodeSpinner')
  const checkmark = document.getElementById('postalCodeCheckmark')
  const suggestion = document.getElementById('addressSuggestion')
  const postalInput = document.getElementById('formPostalCode') as HTMLInputElement | null

  if (prefInfo) {
    prefInfo.textContent = ''
    prefInfo.className = 'text-xs mt-1'
  }
  if (spinner) spinner.classList.add('hidden')
  if (checkmark) checkmark.classList.add('hidden')
  if (suggestion) suggestion.classList.add('hidden')
  if (postalInput) {
    postalInput.classList.remove('border-green-500', 'border-red-500', 'ring-green-200', 'ring-red-200', 'ring-2')
  }
}

/**
 * 郵便番号の自動検索（zipcloud API使用）
 */
async function handlePostalCodeSearch(postalCode: string): Promise<void> {
  const prefInfo = document.getElementById('prefectureInfo')
  const addressInput = document.getElementById('formAddress') as HTMLInputElement
  const spinner = document.getElementById('postalCodeSpinner')
  const checkmark = document.getElementById('postalCodeCheckmark')
  const suggestion = document.getElementById('addressSuggestion')
  const suggestedAddr = document.getElementById('suggestedAddress')
  const postalInput = document.getElementById('formPostalCode') as HTMLInputElement | null

  // ローディング表示
  if (spinner) spinner.classList.remove('hidden')
  if (checkmark) checkmark.classList.add('hidden')
  if (postalInput) {
    postalInput.classList.remove('border-green-500', 'border-red-500', 'ring-green-200', 'ring-red-200', 'ring-2')
  }

  try {
    const result = await searchAddressByZipcode(postalCode)

    if (spinner) spinner.classList.add('hidden')

    if (result) {
      const fullAddress = `${result.prefecture}${result.city}${result.town}`

      // 成功表示
      if (checkmark) checkmark.classList.remove('hidden')
      if (postalInput) {
        postalInput.classList.add('border-green-500', 'ring-green-200', 'ring-2')
      }
      if (prefInfo) {
        prefInfo.textContent = `${result.prefecture} ${result.city} ${result.town}`
        prefInfo.className = 'text-xs mt-1 text-green-600 font-medium'
      }

      // 住所フィールドが空なら直接入力、値があればサジェスト表示
      if (addressInput && addressInput.value.trim() === '') {
        addressInput.value = fullAddress
        addressInput.classList.add('bg-green-50')
        setTimeout(() => addressInput.classList.remove('bg-green-50'), 1500)
      } else if (addressInput && addressInput.value.trim() !== fullAddress) {
        // 既に住所があり、検索結果と異なる場合はサジェスト表示
        if (suggestion && suggestedAddr) {
          suggestedAddr.textContent = fullAddress
          suggestion.classList.remove('hidden')

          const applyBtn = document.getElementById('applySuggestionBtn')
          const dismissBtn = document.getElementById('dismissSuggestionBtn')

          const applyHandler = () => {
            addressInput.value = fullAddress
            addressInput.classList.add('bg-green-50')
            setTimeout(() => addressInput.classList.remove('bg-green-50'), 1500)
            suggestion.classList.add('hidden')
            applyBtn?.removeEventListener('click', applyHandler)
          }
          const dismissHandler = () => {
            suggestion.classList.add('hidden')
            dismissBtn?.removeEventListener('click', dismissHandler)
          }

          applyBtn?.addEventListener('click', applyHandler)
          dismissBtn?.addEventListener('click', dismissHandler)
        }
      }
    } else {
      // エラー表示
      if (postalInput) {
        postalInput.classList.add('border-red-500', 'ring-red-200', 'ring-2')
      }
      if (prefInfo) {
        prefInfo.textContent = '該当する住所が見つかりません'
        prefInfo.className = 'text-xs mt-1 text-red-500'
      }
    }
  } catch (error) {
    console.error('郵便番号検索エラー:', error)
    if (spinner) spinner.classList.add('hidden')
    if (prefInfo) {
      prefInfo.textContent = '検索に失敗しました。もう一度お試しください'
      prefInfo.className = 'text-xs mt-1 text-red-500'
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
