import { jsPDF } from 'jspdf'
import type { PostcardData, SenderInfo, CalibrationSettings } from '../types'

const PAGE_W = 100
const PAGE_H = 148

const RECIPIENT_ZIP = { x: 44.0, y: 12.0, pitch: 6.8 }
const SENDER_ZIP = { x: 6.0, y: 123.0, pitch: 3.6 }

const ADDRESS_AREA_X = 78
const ADDRESS_AREA_TOP = 28
const ADDRESS_FONT_SIZE = 10
const ADDRESS_LINE_GAP = 6

const NAME_X = 45
const NAME_FONT_SIZE = 16

const SENDER_AREA_X = 18
const SENDER_AREA_TOP = 75
const SENDER_FONT_SIZE = 7
const SENDER_LINE_GAP = 4

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
  const charH = fontSize * 0.352778
  let curY = startY
  for (const ch of text) {
    doc.text(ch, x + ox, curY + oy)
    curY += charH * 1.3
  }
  return curY
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

  doc.setFont('Helvetica', 'normal')

  // --- 宛先郵便番号 ---
  const zipDigits = (card.postalCode || '').replace(/\D/g, '').padEnd(7, ' ')
  doc.setFontSize(14)
  doc.setTextColor(200, 0, 0)
  for (let i = 0; i < 7; i++) {
    const xPos = RECIPIENT_ZIP.x + i * RECIPIENT_ZIP.pitch
    doc.text(zipDigits[i], xPos + ox, RECIPIENT_ZIP.y + oy)
  }
  doc.setTextColor(0, 0, 0)

  // --- 宛先住所（縦書き） ---
  const addressLines = splitVerticalLines(card.address, 18)
  let colX = ADDRESS_AREA_X
  for (const line of addressLines) {
    drawVerticalText(doc, line, colX + ox, ADDRESS_AREA_TOP + oy, ADDRESS_FONT_SIZE, 0, 0)
    colX -= ADDRESS_LINE_GAP
  }

  // --- 会社名（住所の続き） ---
  const { addressExtra, mainName } = getAddresseeInfo(card)
  if (addressExtra) {
    colX -= 1
    drawVerticalText(doc, addressExtra, colX + ox, ADDRESS_AREA_TOP + oy, ADDRESS_FONT_SIZE - 1, 0, 0)
    colX -= ADDRESS_LINE_GAP
  }

  // --- 宛名 ---
  drawVerticalText(doc, mainName, NAME_X + ox, ADDRESS_AREA_TOP + 5 + oy, NAME_FONT_SIZE, 0, 0)

  // --- 差出人郵便番号 ---
  const hasSender = sender.companyName || sender.personName || sender.address
  if (!hasSender) return

  const senderZipDigits = (sender.postalCode || '').replace(/\D/g, '').padEnd(7, ' ')
  doc.setFontSize(8)
  doc.setTextColor(200, 0, 0)
  for (let i = 0; i < 7; i++) {
    const xPos = SENDER_ZIP.x + i * SENDER_ZIP.pitch
    doc.text(senderZipDigits[i], xPos + ox, SENDER_ZIP.y + oy)
  }
  doc.setTextColor(0, 0, 0)

  // --- 差出人住所 ---
  let senderColX = SENDER_AREA_X
  if (sender.address) {
    const sLines = splitVerticalLines(sender.address, 20)
    for (const line of sLines) {
      drawVerticalText(doc, line, senderColX + ox, SENDER_AREA_TOP + oy, SENDER_FONT_SIZE, 0, 0)
      senderColX -= SENDER_LINE_GAP
    }
  }

  // --- 差出人名 ---
  let senderNameX = senderColX - 2
  if (sender.companyName) {
    drawVerticalText(doc, sender.companyName, senderNameX + ox, SENDER_AREA_TOP + oy, SENDER_FONT_SIZE + 1, 0, 0)
    senderNameX -= SENDER_LINE_GAP
  }
  if (sender.personName) {
    drawVerticalText(doc, sender.personName, senderNameX + ox, SENDER_AREA_TOP + oy, SENDER_FONT_SIZE, 0, 0)
    senderNameX -= SENDER_LINE_GAP
  }

  // --- 差出人電話番号 ---
  if (sender.phone) {
    doc.setFontSize(5)
    doc.text(`TEL: ${sender.phone}`, senderNameX + ox + 2, SENDER_AREA_TOP + oy, { angle: 90 })
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
