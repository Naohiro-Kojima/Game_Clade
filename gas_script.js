// ============================================================
// Google Apps Script - 交流会ゲームプラットフォーム データ供給
// ============================================================
// 使い方:
//   1. このコードを Google Apps Script エディタに貼り付ける
//   2. SPREADSHEET_ID を実際のスプレッドシートIDに書き換える
//      (スプレッドシートのURLの /d/XXXXXXXXX/edit の部分)
//   3. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
//      - 実行するユーザー: 自分
//      - アクセスできるユーザー: 全員
//   4. デプロイ後に表示されるURLをフロントエンドの app.js に設定する
// ============================================================

var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // ← ここを書き換える

/**
 * GASウェブアプリのエントリーポイント
 * 全シートのデータをまとめてJSONで返す
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var english  = readSheet(ss, '英語限定',    ['お題', 'NGワード'],           ['topic', 'ngwords']);
    var turtle   = readSheet(ss, 'ウミガメ',    ['問題文', '真相'],             ['question', 'answer']);
    var wordwolf = readSheet(ss, 'ワードウルフ', ['市民のお題', 'ウルフのお題'], ['citizen', 'wolf']);

    var payload = JSON.stringify({
      english:  english,
      turtle:   turtle,
      wordwolf: wordwolf
    });

    return ContentService
      .createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorPayload = JSON.stringify({ error: err.message });
    return ContentService
      .createTextOutput(errorPayload)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 指定シートのデータを読み取ってオブジェクト配列で返す
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - スプレッドシート
 * @param {string} sheetName - シート名
 * @param {string[]} headers  - ヘッダー行の列名（確認用、実際の読み取りは位置ベース）
 * @param {string[]} keys     - 出力JSONのキー名（headersと対応）
 * @returns {Object[]} 行データの配列
 */
function readSheet(ss, sheetName, headers, keys) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('シートが見つかりません: ' + sheetName);
    return [];
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    // ヘッダー行しかない（データなし）
    return [];
  }

  var numCols = headers.length;
  var range   = sheet.getRange(2, 1, lastRow - 1, numCols);
  var values  = range.getValues();

  var result = [];
  values.forEach(function(row) {
    // 全セルが空の行はスキップ
    var isEmpty = row.every(function(cell) {
      return cell === '' || cell === null || cell === undefined;
    });
    if (isEmpty) return;

    var obj = {};
    keys.forEach(function(key, i) {
      obj[key] = String(row[i] !== null && row[i] !== undefined ? row[i] : '').trim();
    });
    result.push(obj);
  });

  return result;
}

// ============================================================
// スプレッドシートのシート構成（参考）
// ============================================================
// シート名「英語限定」
//   A列: お題（例: 富士山）
//   B列: NGワード（例: マウント,ボルケーノ,ジャパン）
//
// シート名「ウミガメ」
//   A列: 問題文（例: ある男が海の見えないレストランで...）
//   B列: 真相（例: 男はかつて漂流し...）
//
// シート名「ワードウルフ」
//   A列: 市民のお題（例: 犬）
//   B列: ウルフのお題（例: 猫）
// ============================================================
