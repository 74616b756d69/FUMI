/**
 * 漢数字変換ユーティリティ
 */

const kanjiNumbers: { [key: number]: string } = {
  0: '〇',
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
  10: '十',
  100: '百',
  1000: '千',
  10000: '万'
};

/**
 * アラビア数字を漢数字に変換する
 * @param num 変換する数字
 * @returns 漢数字文字列
 */
export function toKanjiNumber(num: number): string {
  if (num === 0) return kanjiNumbers[0];
  
  if (num < 0) {
    return '負' + toKanjiNumber(Math.abs(num));
  }

  if (num < 10) {
    return kanjiNumbers[num];
  }

  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return kanjiNumbers[tens] + kanjiNumbers[10] + (ones > 0 ? kanjiNumbers[ones] : '');
  }

  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    return kanjiNumbers[hundreds] + kanjiNumbers[100] + (remainder > 0 ? toKanjiNumber(remainder) : '');
  }

  if (num < 10000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return kanjiNumbers[thousands] + kanjiNumbers[1000] + (remainder > 0 ? toKanjiNumber(remainder) : '');
  }

  if (num < 100000000) {
    const manCounter = Math.floor(num / 10000);
    const remainder = num % 10000;
    return toKanjiNumber(manCounter) + kanjiNumbers[10000] + (remainder > 0 ? toKanjiNumber(remainder) : '');
  }

  return String(num);
}

/**
 * 年号を和暦に変換する（令和対応）
 * @param year 西暦年
 * @returns 和暦年号
 */
export function toJapaneseEra(year: number): string {
  if (year >= 2019) {
    return `令和${year - 2018}年`;
  }
  if (year >= 1989) {
    return `平成${year - 1988}年`;
  }
  if (year >= 1926) {
    return `昭和${year - 1925}年`;
  }
  if (year >= 1912) {
    return `大正${year - 1911}年`;
  }
  return `${year}年`;
}
