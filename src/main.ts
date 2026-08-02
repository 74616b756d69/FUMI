import './style.css'
import { AppState, PostcardData, PostcardTemplate } from './types'
import { parseCSV } from './utils/csv'
import { toJapaneseEra, toKanjiNumber } from './utils/kanji'

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
  isLoading: false
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
function initApp(): void {
  const app = getElement('app')
  app.innerHTML = renderMainUI()
  bindEvents()
}

/**
 * メインUI HTML生成
 */
function renderMainUI(): string {
  return `
    <div class="app bg-gray-50">
      <div class="postcard-container">
        <header class="w-full bg-blue-50 shadow-sm border-b border-blue-200">
          <div class="max-w-4xl mx-auto px-6 py-6">
            <h1 class="text-3xl font-bold text-blue-900 mb-2">ハガキ印刷システム</h1>
            <p class="text-blue-700">Vite + TypeScript + Tailwind CSS</p>
          </div>
        </header>

        <main class="w-full max-w-4xl mx-auto px-6 py-8">
          <!-- コントロールパネル -->
          <div class="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-xl font-bold text-slate-800 mb-6">データ入力</h2>
            
            <div class="space-y-4">
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

              <div class="flex gap-4">
                <button id="uploadBtn" class="button-primary">
                  アップロード
                </button>
                <button id="previewBtn" class="button-secondary" disabled>
                  プレビュー
                </button>
                <button id="printBtn" class="button-secondary" disabled>
                  印刷
                </button>
              </div>
            </div>
          </div>

          <!-- プレビューエリア -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold text-slate-800 mb-6">プレビュー</h2>
            <div id="previewContainer" class="flex flex-wrap gap-6 justify-center">
              <p class="text-slate-500 text-center w-full">CSVファイルをアップロードしてください</p>
            </div>
          </div>
        </main>

        <footer class="w-full bg-slate-100 border-t border-slate-200 mt-12">
          <div class="max-w-4xl mx-auto px-6 py-4 text-center text-sm text-slate-600">
            <p>&copy; 2024 ハガキ印刷システム. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  `
}

/**
 * ハガキプレビューのHTML生成
 */
function renderPostcardPreview(postcard: PostcardData): string {
  const year = new Date().getFullYear()
  const japaneseYear = toJapaneseEra(year)

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

      <!-- 中央：メッセージエリア -->
      <div class="flex-1 flex items-center justify-center px-4">
        <p class="text-center text-sm leading-relaxed">${postcard.message}</p>
      </div>

      <!-- ハガキ下部：住所など -->
      <div class="border-t pt-3">
        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p class="font-bold mb-1">〒 ${postcard.postalCode || '000-0000'}</p>
            <p>${postcard.address}</p>
          </div>
          <div class="text-right">
            <p class="font-bold">${postcard.name}</p>
            <p>${postcard.phone || ''}</p>
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
  const uploadBtn = getElement('uploadBtn')
  const csvFile = getElement('csvFile') as HTMLInputElement
  const previewBtn = getElement('previewBtn') as HTMLButtonElement
  const printBtn = getElement('printBtn') as HTMLButtonElement

  uploadBtn.addEventListener('click', handleCSVUpload)
  csvFile.addEventListener('change', () => {
    uploadBtn.disabled = !csvFile.files?.length
  })
  previewBtn.addEventListener('click', handlePreview)
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
    state.postcards = data.map((row, index) => ({
      id: `postcard-${index}`,
      name: row.name || row.名前 || '',
      address: row.address || row.住所 || '',
      message: row.message || row.メッセージ || '',
      postalCode: row.postalCode || row.郵便番号 || '',
      phone: row.phone || row.電話番号 || ''
    }))

    alert(`${state.postcards.length}件のハガキデータを読み込みました`)

    // プレビューと印刷ボタンを有効化
    const previewBtn = getElement('previewBtn') as HTMLButtonElement
    const printBtn = getElement('printBtn') as HTMLButtonElement
    previewBtn.disabled = false
    printBtn.disabled = false

    // プレビューを自動更新
    updatePreview()
  } catch (error) {
    console.error('CSVパース処理でエラーが発生しました:', error)
    alert('CSVファイルの処理に失敗しました')
  } finally {
    state.isLoading = false
  }
}

/**
 * プレビュー表示処理
 */
function handlePreview(): void {
  updatePreview()
}

/**
 * プレビューUI更新
 */
function updatePreview(): void {
  const previewContainer = getElement('previewContainer')

  if (state.postcards.length === 0) {
    previewContainer.innerHTML = '<p class="text-slate-500 text-center w-full">データがありません</p>'
    return
  }

  previewContainer.innerHTML = state.postcards
    .map(postcard => renderPostcardPreview(postcard))
    .join('')
}

/**
 * 印刷処理
 */
function handlePrint(): void {
  window.print()
}

/**
 * アプリケーション起動
 */
document.addEventListener('DOMContentLoaded', initApp)

// HMRサポート（Vite開発サーバー用）
if (import.meta.hot) {
  import.meta.hot.accept()
}
