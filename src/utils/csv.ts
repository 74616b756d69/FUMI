/**
 * CSVパースユーティリティ
 */

/**
 * CSV文字列をパースしてオブジェクト配列に変換する
 * @param csv CSV文字列
 * @returns パースされたデータ配列
 */
export function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]);
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return data;
}

/**
 * CSVの1行をパースする
 * @param line CSV行
 * @returns カラムの配列
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * オブジェクト配列をCSV文字列に変換する
 * @param data オブジェクト配列
 * @returns CSV文字列
 */
export function objectsToCSV(data: Record<string, string>[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const lines: string[] = [];

  // ヘッダー行を追加
  lines.push(headers.map(header => `"${header}"`).join(','));

  // データ行を追加
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      return `"${value.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  });

  return lines.join('\n');
}
