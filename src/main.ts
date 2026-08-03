import './style.css'
import { AppState, PostcardData, SenderInfo, CalibrationSettings } from './types'
import { parseCSV, objectsToCSV } from './utils/csv'
import { toJapaneseEra } from './utils/kanji'
import { storage } from './services/storage'
import { validatePostcardData, normalizePostalCode, searchAddressByZipcode, checkDuplicate } from './utils/validation'
import { generatePostcardPdf } from './utils/pdf'

const SENDER_STORAGE_KEY = 'postcard-app-sender-info'
const CALIBRATION_STORAGE_KEY = 'postcard-app-calibration'
const RECENT_SENDERS_KEY = 'postcard-app-recent-senders'
const MAX_RECENT_SENDERS = 5

/**
 * トースト通知システム
 */
type ToastType = 'success' | 'error' | 'warning' | 'info'

function getToastContainer(): HTMLElement {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  return container
}

function showToast(message: string, type: ToastType = 'info', duration = 3000): void {
  const container = getToastContainer()
  const toast = document.createElement('div')
  toast.className = `toast ${type}`

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `

  const closeBtn = toast.querySelector('.toast-close') as HTMLButtonElement
  const removeToast = () => {
    toast.classList.add('fade-out')
    setTimeout(() => toast.remove(), 300)
  }

  closeBtn.addEventListener('click', removeToast)
  container.appendChild(toast)

  if (duration > 0) {
    setTimeout(removeToast, duration)
  }
}

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

function loadCalibration(): CalibrationSettings {
  try {
    const saved = localStorage.getItem(CALIBRATION_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { offsetX: 0, offsetY: 0 }
}

function saveCalibration(cal: CalibrationSettings): void {
  localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(cal))
}

function loadRecentSenders(): SenderInfo[] {
  try {
    const saved = localStorage.getItem(RECENT_SENDERS_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return []
}

function saveRecentSender(sender: SenderInfo): void {
  try {
    const recent = loadRecentSenders()
    const filtered = recent.filter(s => !(s.companyName === sender.companyName && s.postalCode === sender.postalCode))
    const updated = [sender, ...filtered].slice(0, MAX_RECENT_SENDERS)
    localStorage.setItem(RECENT_SENDERS_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to save recent sender:', error)
  }
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
  searchField: 'all',
  activeCategory: 'all',
  showForm: false,
  editingId: undefined,
  currentView: 'list',
  showSenderForm: false,
  showExportMenu: false,
  senderInfo: loadSenderInfo(),
  showCalibration: false,
  calibration: loadCalibration(),
  recentSenders: loadRecentSenders()
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

function renderDropZone(): string {
  return `
    <div
      id="dropZone"
      class="border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200 ${state.isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} select-none"
      ${state.isLoading ? 'style="pointer-events: none;"' : ''}
    >
      <input type="file" id="csvFile" accept=".csv" class="hidden" ${state.isLoading ? 'disabled' : ''} />
      <div class="flex flex-col items-center justify-center py-10 gap-3 pointer-events-none">
        ${state.isLoading ? `
          <svg class="animate-spin h-12 w-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <p class="text-blue-700 font-semibold text-base">処理中...</p>
        ` : `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p class="text-blue-700 font-semibold text-base">CSVファイルをここにドロップ</p>
          <p class="text-slate-400 text-sm">または</p>
          <span class="px-5 py-2 bg-blue-600 text-white rounded-md font-medium text-sm shadow-sm">
            ファイルを選択
          </span>
        `}
        <p class="text-xs text-slate-400">.csv ファイルのみ対応</p>
      </div>
    </div>
  `
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
          <h1 class="text-3xl font-bold text-blue-900 mb-2">Fumi</h1>
        </div>
      </header>

      <main class="w-full max-w-6xl mx-auto px-6 py-8">
        <!-- カテゴリタブ -->
        <div class="mb-6 flex gap-2 no-print">
          <button id="categoryAllBtn" class="px-4 py-2 rounded-md font-medium transition-colors ${state.activeCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}">
            すべて
          </button>
          <button id="categoryBusinessBtn" class="px-4 py-2 rounded-md font-medium transition-colors ${state.activeCategory === 'business' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}">
            業務用
          </button>
          <button id="categoryPrivateBtn" class="px-4 py-2 rounded-md font-medium transition-colors ${state.activeCategory === 'private' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}">
            プライベート
          </button>
        </div>

        <!-- コントロールパネル -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8 no-print">
          <div class="space-y-4">
            ${renderDropZone()}
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-700">検索</label>
              <div class="flex gap-2">
                <input type="text" id="searchInput" placeholder="検索キーワード..." class="input-field flex-1" value="${state.filterQuery}" />
                <select id="searchFieldSelect" class="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                  <option value="all" ${state.searchField === 'all' ? 'selected' : ''}>すべて</option>
                  <option value="companyName" ${state.searchField === 'companyName' ? 'selected' : ''}>企業名</option>
                  <option value="personName" ${state.searchField === 'personName' ? 'selected' : ''}>名前</option>
                  <option value="address" ${state.searchField === 'address' ? 'selected' : ''}>住所</option>
                  <option value="postalCode" ${state.searchField === 'postalCode' ? 'selected' : ''}>郵便番号</option>
                  <option value="memo" ${state.searchField === 'memo' ? 'selected' : ''}>備考</option>
                </select>
              </div>
              <p class="text-xs text-slate-500">フィールドを選択して検索範囲を絞り込めます</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button id="toggleFormBtn" class="button-secondary">+ 手動登録</button>
              <div class="relative">
                <button id="exportBtn" class="button-secondary" ${state.postcards.length === 0 ? 'disabled' : ''}>エクスポート</button>
                ${state.showExportMenu ? `
                  <div class="absolute top-full mt-2 left-0 bg-white border border-slate-300 rounded-md shadow-lg z-10 min-w-max">
                    <button id="exportAllBtn" class="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-200">すべてエクスポート</button>
                    <button id="exportBusinessBtn" class="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-200">業務用のみ</button>
                    <button id="exportPrivateBtn" class="w-full text-left px-4 py-2 hover:bg-slate-50">プライベートのみ</button>
                  </div>
                ` : ''}
              </div>
              <div class="relative">
                <button id="senderInfoBtn" class="button-secondary">差出人設定</button>
                ${state.recentSenders && state.recentSenders.length > 0 ? `
                  <div class="absolute top-full mt-2 left-0 bg-white border border-slate-300 rounded-md shadow-lg z-10 min-w-max max-w-xs">
                    <div class="px-4 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">最近使った差出人</div>
                    ${state.recentSenders.map((sender, idx) => `
                      <button class="recent-sender-btn w-full text-left px-4 py-2 hover:bg-slate-50 ${idx < state.recentSenders!.length - 1 ? 'border-b border-slate-200' : ''} text-sm truncate" data-index="${idx}" title="${sender.companyName}">
                        ${escapeHtml(sender.companyName)}
                      </button>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
              <button id="calibrationBtn" class="button-secondary">位置補正</button>
              <button id="printFrontBtn" class="button-primary" ${state.postcards.length === 0 ? 'disabled' : ''}>宛名面印刷</button>
              <button id="printBackBtn" class="button-primary" ${state.postcards.length === 0 ? 'disabled' : ''}>裏面印刷</button>
              <button id="pdfExportBtn" class="button-primary" ${state.postcards.length === 0 ? 'disabled' : ''}>PDF出力</button>
              <button id="deleteAllBtn" class="button-secondary text-red-600 hover:bg-red-100" ${state.postcards.length === 0 ? 'disabled' : ''}>全削除</button>
            </div>

            <div class="pt-4 border-t border-slate-200 text-sm text-slate-600">
              <p>合計: <strong>${state.postcards.length}</strong> 件 | 表示中: <strong>${paginatedCards.length}</strong> 件</p>
            </div>
          </div>
        </div>

        ${state.showSenderForm ? renderSenderForm() : ''}
        ${state.showCalibration ? renderCalibrationPanel() : ''}
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
  let cards = state.postcards

  // カテゴリフィルタ
  if (state.activeCategory !== 'all') {
    cards = cards.filter(card => card.category === state.activeCategory)
  }

  // 検索フィルタ
  if (!state.filterQuery) return cards

  const query = state.filterQuery.toLowerCase()
  const queryNumeric = state.filterQuery

  return cards.filter(card => {
    if (state.searchField === 'all') {
      return (
        card.companyName.toLowerCase().includes(query) ||
        card.personName?.toLowerCase().includes(query) ||
        card.address.toLowerCase().includes(query) ||
        card.postalCode?.includes(queryNumeric) ||
        card.memo?.toLowerCase().includes(query)
      )
    } else if (state.searchField === 'companyName') {
      return card.companyName.toLowerCase().includes(query)
    } else if (state.searchField === 'personName') {
      return card.personName?.toLowerCase().includes(query) || false
    } else if (state.searchField === 'address') {
      return card.address.toLowerCase().includes(query)
    } else if (state.searchField === 'postalCode') {
      return card.postalCode?.includes(queryNumeric) || false
    } else if (state.searchField === 'memo') {
      return card.memo?.toLowerCase().includes(query) || false
    }
    return true
  })
}

function renderAddressTable(postcards: PostcardData[]): string {
  const startIndex = (state.currentPage - 1) * state.pageSize
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b-2 border-slate-200 text-left">
            <th class="py-3 px-2 w-10">#</th>
            <th class="py-3 px-2">カテゴリ</th>
            <th class="py-3 px-2">企業名</th>
            <th class="py-3 px-2">名前</th>
            <th class="py-3 px-2 text-slate-400 font-normal text-xs">フリガナ</th>
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
              <td class="py-2 px-2">
                <span class="inline-block px-2 py-1 text-xs rounded font-medium ${card.category === 'business' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
                  ${card.category === 'business' ? '業務用' : 'プライベート'}
                </span>
              </td>
              <td class="py-2 px-2 font-medium">${escapeHtml(card.companyName)}</td>
              <td class="py-2 px-2">${escapeHtml(card.personName || '')}</td>
              <td class="py-2 px-2 text-slate-400 text-xs">${escapeHtml(card.furigana || '')}</td>
              <td class="py-2 px-2 whitespace-nowrap">${escapeHtml(card.postalCode || '')}</td>
              <td class="py-2 px-2">${escapeHtml(card.address)}</td>
              <td class="py-2 px-2 whitespace-nowrap">${escapeHtml(card.phone || '')}</td>
              <td class="py-2 px-2 text-slate-500">${escapeHtml(card.memo || '')}</td>
              <td class="py-2 px-2">
                <div class="flex gap-1">
                  <button class="edit-btn text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" data-id="${card.id}" aria-label="ハガキ ${escapeHtml(card.companyName)} を編集">編集</button>
                  <button class="delete-btn text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" data-id="${card.id}" aria-label="ハガキ ${escapeHtml(card.companyName)} を削除">削除</button>
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

function renderCalibrationPanel(): string {
  const cal = state.calibration
  return `
    <div class="bg-amber-50 rounded-lg shadow-md p-6 mb-8 border-2 border-amber-200 no-print">
      <h3 class="text-lg font-bold text-amber-900 mb-4">印刷位置微調整（キャリブレーション）</h3>
      <p class="text-sm text-slate-600 mb-4">プリンタの個体差による位置ズレを補正します。0.1mm単位で調整可能です。</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            左右オフセット (X): <span id="calXValue" class="font-bold text-amber-700">${cal.offsetX.toFixed(1)}</span> mm
          </label>
          <input type="range" id="calXSlider" class="w-full accent-amber-500" min="-15" max="15" step="0.1" value="${cal.offsetX}" />
          <div class="flex justify-between text-xs text-slate-400 mt-1"><span>-15mm</span><span>0</span><span>+15mm</span></div>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            上下オフセット (Y): <span id="calYValue" class="font-bold text-amber-700">${cal.offsetY.toFixed(1)}</span> mm
          </label>
          <input type="range" id="calYSlider" class="w-full accent-amber-500" min="-15" max="15" step="0.1" value="${cal.offsetY}" />
          <div class="flex justify-between text-xs text-slate-400 mt-1"><span>-15mm</span><span>0</span><span>+15mm</span></div>
        </div>
      </div>
      <div class="flex gap-2 pt-4">
        <button id="calSaveBtn" class="button-primary">保存</button>
        <button id="calResetBtn" class="button-secondary">リセット</button>
        <button id="calCloseBtn" class="button-secondary">閉じる</button>
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
        <div class="bg-slate-100 p-4 rounded-md mb-4">
          <label class="block text-sm font-medium text-slate-700 mb-2">カテゴリ</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" id="categoryBusiness" name="formCategory" value="business" ${!editing || editing.category === 'business' ? 'checked' : ''} class="w-4 h-4" />
              <span class="text-sm text-slate-700">業務用</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" id="categoryPrivate" name="formCategory" value="private" ${editing?.category === 'private' ? 'checked' : ''} class="w-4 h-4" />
              <span class="text-sm text-slate-700">プライベート</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="formCompanyName" class="block text-sm font-medium text-slate-700 mb-2">
              企業名 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="formCompanyName"
              class="input-field"
              value="${editing?.companyName || ''}"
              maxlength="60"
              required
              aria-required="true"
              aria-label="企業名（必須、1～60文字）"
            />
            <p class="text-xs text-slate-500 mt-1">1〜60文字</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">名前</label>
            <input type="text" id="formPersonName" class="input-field" maxlength="50" value="${editing?.personName || ''}" />
            <p class="text-xs text-slate-500 mt-1">0〜50文字（オプション）</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">フリガナ</label>
            <input type="text" id="formFurigana" class="input-field" value="${editing?.furigana || ''}" placeholder="カタカナ" />
            <p class="text-xs text-slate-500 mt-1">オプション</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="formPostalCode" class="block text-sm font-medium text-slate-700 mb-2">
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
                aria-required="true"
                aria-label="郵便番号（必須、XXX-XXXX形式）"
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
          <label for="formAddress" class="block text-sm font-medium text-slate-700 mb-2">
            住所 <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="formAddress"
            class="input-field"
            value="${editing?.address || ''}"
            required
            aria-required="true"
            aria-label="住所（必須、5～200文字）"
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
 * 宛名情報の組み立て
 * - 名前があれば「様」を付けてメイン表記にする
 * - 名前がなければ会社名をメイン表記にする
 * - 名前と会社名の両方があれば、住所の続きに会社名を改行して追加し、氏名をメイン表記にする
 */
function getAddresseeInfo(card: PostcardData): { addressExtra: string; mainName: string } {
  const company = card.companyName?.trim() || ''
  const person = card.personName?.trim() || ''

  if (person) {
    return { addressExtra: company, mainName: `${person} 様` }
  }
  return { addressExtra: '', mainName: company }
}

function toVerticalText(text: string): string {
  const halfToFull: Record<string, string> = {
    '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
    '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
    '-': '丨', 'ー': '丨'
  }
  return text.replace(/[0-9\-ー]/g, ch => halfToFull[ch] || ch)
}

function renderZipcodeBoxes(postalCode: string): string {
  const digits = (postalCode || '').replace(/\D/g, '').padEnd(7, ' ').split('')
  return `
    <div class="postcard-front-zipcode">
      <div class="zip-group-3">
        ${digits.slice(0, 3).map(d => `<span class="zip-box">${escapeHtml(d.trim())}</span>`).join('')}
      </div>
      <div class="zip-group-4">
        ${digits.slice(3, 7).map(d => `<span class="zip-box">${escapeHtml(d.trim())}</span>`).join('')}
      </div>
    </div>
  `
}

function renderPostcardFront(card: PostcardData): string {
  const { addressExtra, mainName } = getAddresseeInfo(card)
  const s = state.senderInfo
  const hasSender = s.companyName || s.personName || s.address

  return `
    <div class="postcard-front">
      <div class="postcard-front-stamp">切手</div>
      ${renderZipcodeBoxes(card.postalCode || '')}
      <div class="postcard-front-address-area">
        <p class="address-line">${escapeHtml(toVerticalText(card.address))}</p>
        ${addressExtra ? `<p class="address-line address-company">${escapeHtml(toVerticalText(addressExtra))}</p>` : ''}
      </div>
      <div class="postcard-front-name-area">
        <p class="address-name">${escapeHtml(toVerticalText(mainName))}</p>
      </div>
      ${hasSender ? `
        <div class="postcard-front-sender">
          ${s.postalCode ? `<p class="sender-zip">〒${escapeHtml(s.postalCode)}</p>` : ''}
          ${s.address ? `<p class="sender-addr">${escapeHtml(toVerticalText(s.address))}</p>` : ''}
          ${s.companyName ? `<p class="sender-co">${escapeHtml(toVerticalText(s.companyName))}</p>` : ''}
          ${s.personName ? `<p class="sender-nm">${escapeHtml(toVerticalText(s.personName))}</p>` : ''}
        </div>
      ` : ''}
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
  // キーボード操作
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.showForm) {
        state.showForm = false
        state.editingId = undefined
        render()
      } else if (state.showSenderForm) {
        state.showSenderForm = false
        render()
      } else if (state.showCalibration) {
        state.showCalibration = false
        render()
      }
    }
  })

  // ドラッグ&ドロップ / ファイル選択
  const dropZone = getElement('dropZone')
  const csvFile = getElement('csvFile') as HTMLInputElement

  dropZone.addEventListener('click', () => csvFile.click())

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropZone.classList.add('border-blue-500', 'bg-blue-100', 'scale-[1.02]')
  })

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-500', 'bg-blue-100', 'scale-[1.02]')
  })

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault()
    dropZone.classList.remove('border-blue-500', 'bg-blue-100', 'scale-[1.02]')
    const file = (e as DragEvent).dataTransfer?.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      alert('CSVファイルを選択してください')
      return
    }
    await processCSVFile(file)
  })

  csvFile.addEventListener('change', async () => {
    const file = csvFile.files?.[0]
    if (file) await processCSVFile(file)
  })

  // フォーム制御
  const toggleFormBtn = getElement('toggleFormBtn')
  toggleFormBtn.addEventListener('click', () => {
    state.showForm = !state.showForm
    state.editingId = undefined
    render()
  })

  // カテゴリ切り替え
  const categoryAllBtn = document.getElementById('categoryAllBtn')
  const categoryBusinessBtn = document.getElementById('categoryBusinessBtn')
  const categoryPrivateBtn = document.getElementById('categoryPrivateBtn')

  if (categoryAllBtn) {
    categoryAllBtn.addEventListener('click', () => {
      state.activeCategory = 'all'
      state.currentPage = 1
      render()
    })
  }
  if (categoryBusinessBtn) {
    categoryBusinessBtn.addEventListener('click', () => {
      state.activeCategory = 'business'
      state.currentPage = 1
      render()
    })
  }
  if (categoryPrivateBtn) {
    categoryPrivateBtn.addEventListener('click', () => {
      state.activeCategory = 'private'
      state.currentPage = 1
      render()
    })
  }

  // 検索
  const searchInput = getElement('searchInput') as HTMLInputElement
  const searchFieldSelect = document.getElementById('searchFieldSelect') as HTMLSelectElement

  searchInput.addEventListener('input', (e) => {
    state.filterQuery = (e.target as HTMLInputElement).value
    state.currentPage = 1
    render()
  })

  if (searchFieldSelect) {
    searchFieldSelect.addEventListener('change', (e) => {
      state.searchField = (e.target as HTMLSelectElement).value as any
      state.currentPage = 1
      render()
    })
  }

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
      if (id && confirm('を削除しますか？')) {
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

  // 最近使った差出人
  const recentSenderBtns = document.querySelectorAll('.recent-sender-btn')
  recentSenderBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0', 10)
      if (state.recentSenders && state.recentSenders[index]) {
        state.senderInfo = state.recentSenders[index]
        saveSenderInfo(state.senderInfo)
        showToast(`差出人「${state.senderInfo.companyName}」を読み込みました`, 'success')
      }
    })
  })

  const senderForm = document.getElementById('senderForm') as HTMLFormElement
  if (senderForm) {
    senderForm.addEventListener('submit', (e) => {
      e.preventDefault()
      try {
        state.senderInfo = {
          companyName: (document.getElementById('senderCompanyName') as HTMLInputElement).value.trim(),
          personName: (document.getElementById('senderPersonName') as HTMLInputElement).value.trim(),
          postalCode: (document.getElementById('senderPostalCode') as HTMLInputElement).value.trim(),
          address: (document.getElementById('senderAddress') as HTMLInputElement).value.trim(),
          phone: (document.getElementById('senderPhone') as HTMLInputElement).value.trim()
        }
        saveSenderInfo(state.senderInfo)
        saveRecentSender(state.senderInfo)
        state.recentSenders = loadRecentSenders()
        state.showSenderForm = false
        render()
        showToast('差出人情報を保存しました', 'success')
      } catch (error) {
        console.error('差出人情報保存エラー:', error)
        showToast('差出人情報の保存に失敗しました', 'error')
      }
    })
  }

  const cancelSenderBtn = document.getElementById('cancelSenderBtn')
  if (cancelSenderBtn) {
    cancelSenderBtn.addEventListener('click', () => {
      state.showSenderForm = false
      render()
    })
  }

  // キャリブレーション
  const calibrationBtn = document.getElementById('calibrationBtn')
  if (calibrationBtn) {
    calibrationBtn.addEventListener('click', () => {
      state.showCalibration = !state.showCalibration
      render()
    })
  }

  const calXSlider = document.getElementById('calXSlider') as HTMLInputElement | null
  const calYSlider = document.getElementById('calYSlider') as HTMLInputElement | null
  if (calXSlider) {
    calXSlider.addEventListener('input', () => {
      state.calibration.offsetX = parseFloat(calXSlider.value)
      const label = document.getElementById('calXValue')
      if (label) label.textContent = state.calibration.offsetX.toFixed(1)
    })
  }
  if (calYSlider) {
    calYSlider.addEventListener('input', () => {
      state.calibration.offsetY = parseFloat(calYSlider.value)
      const label = document.getElementById('calYValue')
      if (label) label.textContent = state.calibration.offsetY.toFixed(1)
    })
  }

  const calSaveBtn = document.getElementById('calSaveBtn')
  if (calSaveBtn) {
    calSaveBtn.addEventListener('click', () => {
      saveCalibration(state.calibration)
      alert(`位置補正を保存しました（X: ${state.calibration.offsetX.toFixed(1)}mm, Y: ${state.calibration.offsetY.toFixed(1)}mm）`)
    })
  }

  const calResetBtn = document.getElementById('calResetBtn')
  if (calResetBtn) {
    calResetBtn.addEventListener('click', () => {
      state.calibration = { offsetX: 0, offsetY: 0 }
      saveCalibration(state.calibration)
      render()
    })
  }

  const calCloseBtn = document.getElementById('calCloseBtn')
  if (calCloseBtn) {
    calCloseBtn.addEventListener('click', () => {
      state.showCalibration = false
      render()
    })
  }

  // エクスポート・削除・印刷・PDF出力
  const exportBtn = getElement('exportBtn')
  const exportAllBtn = document.getElementById('exportAllBtn')
  const exportBusinessBtn = document.getElementById('exportBusinessBtn')
  const exportPrivateBtn = document.getElementById('exportPrivateBtn')
  const deleteAllBtn = getElement('deleteAllBtn')
  const printBackBtn = document.getElementById('printBackBtn')
  const printFrontBtn = document.getElementById('printFrontBtn')
  const pdfExportBtn = document.getElementById('pdfExportBtn')

  exportBtn.addEventListener('click', () => {
    state.showExportMenu = !state.showExportMenu
    render()
  })

  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => handleExport())
  }
  if (exportBusinessBtn) {
    exportBusinessBtn.addEventListener('click', () => handleExport('business'))
  }
  if (exportPrivateBtn) {
    exportPrivateBtn.addEventListener('click', () => handleExport('private'))
  }

  deleteAllBtn.addEventListener('click', handleDeleteAll)
  if (printBackBtn) {
    printBackBtn.addEventListener('click', handlePrintBack)
  }
  if (printFrontBtn) {
    printFrontBtn.addEventListener('click', handlePrintFront)
  }
  if (pdfExportBtn) {
    pdfExportBtn.addEventListener('click', handlePdfExport)
  }
}

/**
 * CSVファイル処理（ドロップ / ファイル選択の共通処理）
 */
async function processCSVFile(file: File): Promise<void> {
  try {
    state.isLoading = true

    // ファイルサイズチェック（最大5MB）
    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      showToast('ファイルサイズが大きすぎます（最大5MB）', 'error')
      return
    }

    const text = await file.text()
    const data = parseCSV(text)

    if (data.length === 0) {
      showToast('CSVファイルにデータが含まれていません', 'warning')
      return
    }

    const newCards = data.map((row) => {
      const prefecture = row['都道府県'] || ''
      const city = row['市区町村'] || ''
      const street = row['番地・建物名'] || ''
      const combinedAddress = [prefecture, city, street].filter(Boolean).join('')
      return {
        category: (row.category || row['カテゴリ'] || 'business') as any,
        companyName: row.companyName || row['企業名'] || '',
        personName: row.personName || row['名前'] || '',
        furigana: row.furigana || row['フリガナ'] || '',
        address: row.address || row['住所'] || combinedAddress,
        memo: row.memo || row['備考'] || '',
        postalCode: normalizePostalCode(row.postalCode || row['郵便番号'] || '') || '',
        phone: row.phone || row['電話番号'] || '',
        createdAt: Date.now()
      }
    })

    await storage.bulkInsert(newCards)
    const allCards = await storage.getAll()
    state.postcards = allCards
    state.currentPage = 1
    state.filterQuery = ''

    showToast(`${newCards.length}件のハガキデータを追加しました`, 'success')
    const csvFile = document.getElementById('csvFile') as HTMLInputElement | null
    if (csvFile) csvFile.value = ''
    render()
  } catch (error) {
    console.error('CSVパース処理でエラーが発生しました:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('encoding') || errorMsg.includes('parse')) {
      showToast('CSVファイルのフォーマットが正しくありません。UTF-8形式で保存されているか確認してください', 'error', 5000)
    } else {
      showToast('CSVファイルの処理に失敗しました。ファイルを確認してもう一度お試しください', 'error', 5000)
    }
  } finally {
    state.isLoading = false
  }
}

/**
 * フォーム送信処理
 */
async function handleFormSubmit(e: Event): Promise<void> {
  e.preventDefault()

  const category = (document.querySelector('input[name="formCategory"]:checked') as HTMLInputElement).value as any
  const companyName = (document.getElementById('formCompanyName') as HTMLInputElement).value.trim()
  const personName = (document.getElementById('formPersonName') as HTMLInputElement).value.trim()
  const furigana = (document.getElementById('formFurigana') as HTMLInputElement).value.trim()
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
    const errors = Object.values(validation.errors).filter(Boolean)
    if (errors.length > 0) {
      errors.forEach(error => {
        showToast(error, 'error', 4000)
      })
      return
    }
  }

  // 重複チェック
  const duplicateCheck = checkDuplicate(postalCode, companyName, state.postcards, state.editingId)
  if (duplicateCheck.isDuplicate && duplicateCheck.existingRecord) {
    const msg = `⚠️ 郵便番号 ${postalCode} と企業名「${companyName}」の組み合わせは既に登録されています（${duplicateCheck.existingRecord.personName ? duplicateCheck.existingRecord.personName + '様' : ''}）。続けて登録しますか？`
    if (!confirm(msg)) {
      return
    }
  }

  try {
    state.isLoading = true
    const normalized = normalizePostalCode(postalCode) || postalCode

    if (state.editingId) {
      await storage.update(state.editingId, {
        category,
        companyName,
        personName: personName || undefined,
        furigana: furigana || undefined,
        postalCode: normalized,
        address,
        memo,
        phone: phone || undefined
      })
    } else {
      await storage.add({
        category,
        companyName,
        personName: personName || undefined,
        furigana: furigana || undefined,
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

    showToast(state.editingId ? 'ハガキを更新しました' : 'ハガキを追加しました', 'success')
    render()
  } catch (error) {
    console.error('フォーム処理でエラーが発生しました:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    showToast(`処理に失敗しました: ${errorMsg}`, 'error', 4000)
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

    showToast('ハガキを削除しました', 'success')
    render()
  } catch (error) {
    console.error('削除処理でエラーが発生しました:', error)
    showToast('削除に失敗しました', 'error')
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
    showToast('すべてのハガキを削除しました', 'success')
    render()
  } catch (error) {
    console.error('全削除処理でエラーが発生しました:', error)
    showToast('削除に失敗しました', 'error')
  } finally {
    state.isLoading = false
  }
}

/**
 * CSVエクスポート
 */
async function handleExport(category?: string): Promise<void> {
  try {
    let cards = state.postcards
    if (category) {
      cards = cards.filter(card => card.category === category)
    }

    const data = cards.map(card => ({
      'カテゴリ': card.category === 'business' ? '業務用' : 'プライベート',
      '企業名': card.companyName,
      '名前': card.personName || '',
      'フリガナ': card.furigana || '',
      '郵便番号': card.postalCode || '',
      '住所': card.address,
      '備考': card.memo || '',
      '電話番号': card.phone || '',
      '登録日': new Date(card.createdAt).toLocaleDateString('ja-JP')
    }))

    if (data.length === 0) {
      alert('エクスポートするデータがありません')
      return
    }

    const csv = objectsToCSV(data)
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    const timestamp = Date.now()
    const suffix = category ? (category === 'business' ? '-business' : '-private') : ''

    link.href = url
    link.download = `postcards${suffix}-${timestamp}.csv`
    link.click()

    URL.revokeObjectURL(url)
    state.showExportMenu = false
    render()
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
  applyCalibrationToCards()

  requestAnimationFrame(() => {
    window.print()
  })
}

function applyCalibrationToCards(): void {
  const cards = document.querySelectorAll<HTMLElement>('.postcard-front, .postcard-back')
  cards.forEach(el => {
    el.style.setProperty('--offset-x', `${state.calibration.offsetX}mm`)
    el.style.setProperty('--offset-y', `${state.calibration.offsetY}mm`)
  })
}

function handlePrintFront(): void {
  const printArea = document.getElementById('printArea')
  if (!printArea) return

  if (state.postcards.length === 0) {
    alert('印刷するデータがありません')
    return
  }

  printArea.innerHTML = state.postcards.map(card => renderPostcardFront(card)).join('')
  applyCalibrationToCards()

  requestAnimationFrame(() => {
    window.print()
  })
}

function handlePdfExport(): void {
  if (state.postcards.length === 0) {
    alert('出力するデータがありません')
    return
  }
  generatePostcardPdf(state.postcards, state.senderInfo, state.calibration)
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

    const errorMsg = error instanceof Error ? error.message : String(error)
    const isTimeout = errorMsg.includes('タイムアウト')

    if (prefInfo) {
      if (isTimeout) {
        prefInfo.innerHTML = `
          <span class="text-red-500">検索がタイムアウトしました。</span>
          <button class="text-red-600 underline hover:text-red-700 mt-1 block" id="retryPostalCodeBtn">もう一度試す</button>
        `
        prefInfo.className = 'text-xs mt-1'

        const retryBtn = document.getElementById('retryPostalCodeBtn')
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            handlePostalCodeSearch(postalCode)
          })
        }
      } else {
        prefInfo.textContent = '検索に失敗しました。ネットワークをご確認ください'
        prefInfo.className = 'text-xs mt-1 text-red-500'
      }
    }

    showToast(isTimeout ? '郵便番号検索がタイムアウトしました' : '郵便番号検索に失敗しました', 'error')
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
