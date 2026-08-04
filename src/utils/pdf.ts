import { jsPDF } from 'jspdf'
import type { PostcardData, SenderInfo, CalibrationSettings } from '../types'

/* 日本郵便ハガキ規格（100mm × 148mm） */
const PAGE_W = 100
const PAGE_H = 148

/* 宛先郵便番号枠 - 日本郵便規格準拠 */
/* 左上から右44mm、上8mm、各枠のサイズ5.7mm × 8mm、ピッチ6.8mm */
const RECIPIENT_ZIP = { x: 43.0, y: 8.5, pitch: 6.8, boxW: 5.7, boxH: 8.0 }

/* 差出人郵便番号 - 左下 */
const SENDER_ZIP = { x: 7.5, y: 121.0, pitch: 3.5 }

/* 宛先住所（縦書き） - 右寄り */
const ADDRESS_AREA_X = 76.0
const ADDRESS_AREA_TOP = 25.0
const ADDRESS_FONT_SIZE = 10.5
const ADDRESS_LINE_GAP = 6.5

/* 宛名（大きく中央） - 縦書き */
const NAME_X = 43.0
const NAME_AREA_TOP = 32.0
const NAME_FONT_SIZE = 17.0

/* 差出人情報 - 左下 */
const SENDER_AREA_X = 17.0
const SENDER_AREA_TOP = 78.0
const SENDER_FONT_SIZE = 7.5
const SENDER_LINE_GAP = 4.2

function splitVerticalLines(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = []
  for (let i = 0; i < text.length; i += maxCharsPerLine) {
    lines.push(text.slice(i, i + maxCharsPerLine))
  }
  return lines
}

function drawVerticalText(
  doc: jsPDF,
  text: string,
  x: number,
  startY: number,
  fontSize: number,
  ox: number,
  oy: number
): number {
  doc.setFontSize(fontSize)
  const charH = fontSize * 0.3527
  let curY = startY
  for (const ch of text) {
    doc.text(ch, x + ox, curY + oy, { align: 'center' })
    curY += charH * 1.35
  }
  return curY
}

function drawZipCodeBoxes(
  doc: jsPDF,
  digits: string[],
  config: { x: number; y: number; pitch: number; boxW?: number; boxH?: number },
  ox: number,
  oy: number,
  isRecipient: boolean = true
): void {
  doc.setTextColor(isRecipient ? 200 : 0, 0, 0)
  doc.setFontSize(isRecipient ? 14 : 8)

  if (config.boxW && config.boxH) {
    // 枠線を描画（赤）
    doc.setDrawColor(200, 0, 0)
    doc.setLineWidth(0.3)
    for (let i = 0; i < digits.length; i++) {
      const xPos = config.x + i * config.pitch + ox
      const yPos = config.y + oy
      doc.rect(xPos, yPos, config.boxW, config.boxH)
      // 数字を枠の中に
      doc.text(digits[i], xPos + config.boxW / 2, yPos + config.boxH * 0.65, { align: 'center' })
    }
  } else {
    // 枠線なし（差出人用）
    for (let i = 0; i < digits.length; i++) {
      const xPos = config.x + i * config.pitch + ox
      doc.text(digits[i], xPos, config.y + oy)
    }
  }
}

function getAddresseeInfo(card: PostcardData): { addressExtra: string; mainName: string } {
  const company = card.companyName?.trim() || ''
  const person = card.personName?.trim() || ''
  if (person) {
    return { addressExtra: company, mainName: `${person} 様` }
  }
  return { addressExtra: '', mainName: company }
}

function drawPostcardFront(
  doc: jsPDF,
  card: PostcardData,
  sender: SenderInfo,
  cal: CalibrationSettings
): void {
  const ox = cal.offsetX
  const oy = cal.offsetY

  doc.setFont('Serif', 'normal')

  // --- 宛先郵便番号 ---
  const zipDigits = (card.postalCode || '').replace(/\D/g, '').padEnd(7, ' ').split('')
  drawZipCodeBoxes(doc, zipDigits, RECIPIENT_ZIP, ox, oy, true)

  // --- 宛先住所（縦書き） ---
  const addressLines = splitVerticalLines(card.address, 17)
  let colX = ADDRESS_AREA_X
  for (const line of addressLines) {
    drawVerticalText(doc, line, colX, ADDRESS_AREA_TOP, ADDRESS_FONT_SIZE, ox, oy)
    colX -= ADDRESS_LINE_GAP
  }

  // --- 会社名（住所の続き） ---
  const { addressExtra, mainName } = getAddresseeInfo(card)
  if (addressExtra) {
    colX -= 1.5
    drawVerticalText(doc, addressExtra, colX, ADDRESS_AREA_TOP, ADDRESS_FONT_SIZE - 1, ox, oy)
    colX -= ADDRESS_LINE_GAP
  }

  // --- 宛名 ---
  drawVerticalText(doc, mainName, NAME_X, NAME_AREA_TOP, NAME_FONT_SIZE, ox, oy)

  // --- 差出人郵便番号 ---
  const hasSender = sender.companyName || sender.personName || sender.address
  if (!hasSender) return

  const senderZipDigits = (sender.postalCode || '').replace(/\D/g, '').padEnd(7, ' ').split('')
  drawZipCodeBoxes(doc, senderZipDigits, SENDER_ZIP, ox, oy, false)

  // --- 差出人住所 ---
  let senderColX = SENDER_AREA_X
  if (sender.address) {
    const sLines = splitVerticalLines(sender.address, 18)
    for (const line of sLines) {
      drawVerticalText(doc, line, senderColX, SENDER_AREA_TOP, SENDER_FONT_SIZE, ox, oy)
      senderColX -= SENDER_LINE_GAP
    }
  }

  // --- 差出人名 ---
  let senderNameX = senderColX - 2
  if (sender.companyName) {
    drawVerticalText(doc, sender.companyName, senderNameX, SENDER_AREA_TOP, SENDER_FONT_SIZE + 1.5, ox, oy)
    senderNameX -= SENDER_LINE_GAP
  }
  if (sender.personName) {
    drawVerticalText(doc, sender.personName, senderNameX, SENDER_AREA_TOP, SENDER_FONT_SIZE, ox, oy)
    senderNameX -= SENDER_LINE_GAP
  }

  // --- 差出人電話番号（横書き） ---
  if (sender.phone) {
    doc.setFontSize(5)
    doc.setTextColor(0, 0, 0)
    doc.text(`TEL: ${sender.phone}`, senderNameX + ox + 1, SENDER_AREA_TOP + 40 + oy, { angle: 90 })
  }
}

export function generatePostcardPdf(
  cards: PostcardData[],
  sender: SenderInfo,
  calibration: CalibrationSettings
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAGE_W, PAGE_H]
  })

  cards.forEach((card, i) => {
    if (i > 0) doc.addPage([PAGE_W, PAGE_H])
    drawPostcardFront(doc, card, sender, calibration)
  })

  doc.save(`postcards-${Date.now()}.pdf`)
}
