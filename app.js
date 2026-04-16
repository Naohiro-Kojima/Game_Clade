// ============================================================
// 交流会ゲームプラットフォーム - メインスクリプト
// ============================================================

// ============================================================
// ▼▼▼ GAS URL をここに設定する ▼▼▼
// GAS をデプロイして取得した「ウェブアプリURL」を貼り付けてください。
// 未設定のままでもダミーデータで動作します。
// ============================================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycby7tWpVeNsf2_i9LoJwnHnzKBu91CvcY_OZt7rHAmKrm2pCU31eDSWh5-3XPiJA5d_N/exec';
// ============================================================

// ---------- ダミーデータ（GAS未設定 or フェッチ失敗時に使用） ----------
const DUMMY_DATA = {
  english: [
    { topic: '富士山', ngwords: 'マウント,ボルケーノ,ジャパン,ヤマ' },
    { topic: '寿司', ngwords: 'ライス,フィッシュ,スシ,シーフード' },
    { topic: '新幹線', ngwords: 'トレイン,ブレット,スピード,レール' },
    { topic: '桜', ngwords: 'フラワー,ピンク,ツリー,チェリー' },
    { topic: '温泉', ngwords: 'ホット,ウォーター,バス,スパ' },
    { topic: '侍', ngwords: 'ソード,ジャパン,ウォーリアー,カタナ' },
  ],
  turtle: [
    {
      question: 'ある男が、海の見えないレストランでウミガメのスープを一口飲んだ。彼は涙を流して家に帰り、その夜自ら命を絶った。なぜ？',
      answer: '男はかつて漂流し、船の仲間が作ってくれたスープで生き延びた。そのスープを「ウミガメのスープ」だと思っていたが、レストランで本物を口にしたとき、あのスープが仲間の肉だったと悟った。'
    },
    {
      question: 'ある女性が、毎朝エレベーターで7階まで上がり、その後階段で10階の自室まで歩く。雨の日だけエレベーターで10階まで直行する。なぜ？',
      answer: '女性は背が低く、普段は傘の先でしか7階のボタンしか押せない。雨の日は傘を持っているので、それを使って10階のボタンを押せる。'
    },
    {
      question: '男が草原の真ん中で死んでいた。傍らには折れた棒がある。なぜ彼は死んだのか？',
      answer: '彼は盲目の綱渡り師だった。棒は長い棒（バランス棒）で、盲目の彼は棒の長さで自分が綱の上にいることを確認していた。棒が折れたとき、彼は自分がどこにいるかわからなくなり、転落した。'
    },
  ],
  wordwolf: [
    { citizen: '犬', wolf: '猫' },
    { citizen: 'コーヒー', wolf: '紅茶' },
    { citizen: '電車', wolf: 'バス' },
    { citizen: '夏', wolf: '冬' },
    { citizen: 'ラーメン', wolf: 'うどん' },
    { citizen: '映画館', wolf: 'カラオケ' },
  ]
};

// ---------- アプリケーション状態 ----------
const state = {
  data: null,         // { english, turtle, wordwolf } フェッチ後に格納
  loading: false,
  fetchError: false,
  usingDummy: false,
  activeTab: 'english',

  english: {
    current: null,    // { topic, ngwords }
    flipped: false,
  },

  turtle: {
    current: null,    // { question, answer }
    questionRevealed: false,
    answerRevealed: false,  // フリップ廃止→フェードイン展開
  },

  wordwolf: {
    flipped: false,
    result: null,     // { isWolf, topic }
  }
};

// ============================================================
// ユーティリティ
// ============================================================

/**
 * djb2 ハッシュ関数 — 文字列から 32bit unsigned integer を生成
 * @param {string} str
 * @returns {number}
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash | 0; // 32bit 符号付き整数に丸める
  }
  return hash >>> 0; // 符号なし 32bit に変換
}

/**
 * Mulberry32 シード付き疑似乱数生成器
 * @param {number} seed - 初期シード値
 * @returns {function(): number} — 0以上1未満のfloatを返す関数
 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ステータスメッセージを更新する
 * @param {string} elementId
 * @param {string} message
 * @param {'normal'|'loading'|'error'} type
 */
function setStatus(elementId, message, type = 'normal') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'status-message'
    + (type === 'loading' ? ' is-loading' : '')
    + (type === 'error' ? ' is-error' : '');
}

// ============================================================
// データ取得
// ============================================================

function isDummyMode() {
  return !GAS_URL || GAS_URL.trim() === '' || GAS_URL === 'YOUR_GAS_URL_HERE';
}

async function loadData() {
  if (isDummyMode()) {
    state.data = DUMMY_DATA;
    state.usingDummy = true;
    state.fetchError = false;
    return;
  }

  state.loading = true;
  try {
    const res = await fetch(GAS_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json.english || !json.turtle || !json.wordwolf) {
      throw new Error('レスポンスの形式が不正です');
    }
    state.data = json;
    state.usingDummy = false;
    state.fetchError = false;
  } catch (err) {
    console.warn('[GAS fetch 失敗] ダミーデータを使用します:', err.message);
    state.data = DUMMY_DATA;
    state.usingDummy = true;
    state.fetchError = true;
  } finally {
    state.loading = false;
  }
}

// ============================================================
// データソースバッジ
// ============================================================

function renderDataSourceBadge() {
  const container = document.getElementById('data-source-badge-container');
  if (!container) return;

  if (state.usingDummy) {
    const label = state.fetchError
      ? '⚠ GAS取得失敗 — ダミーデータ使用中'
      : '● ダミーデータ使用中（GAS URL 未設定）';
    container.innerHTML = `<span class="data-source-badge is-dummy">${label}</span>`;
  } else {
    container.innerHTML = `<span class="data-source-badge is-live">● GAS データ取得済み</span>`;
  }
}

// ============================================================
// カードフリップ
// ============================================================

/**
 * カードをフリップする（.is-flipped を追加）
 */
function flipCard(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.classList.add('is-flipped');
}

/**
 * カードをアニメーションなしでリセットする
 */
function resetCard(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.style.transition = 'none';
  card.classList.remove('is-flipped');
  void card.offsetWidth; // 強制リフロー
  card.style.transition = '';
}

/**
 * すでにフリップ済みのカードを一度リセットしてから再フリップする
 * @param {string} cardId
 * @param {Function} onBeforeFlip - フリップ前に中身を書き換えるコールバック
 */
function reflipCard(cardId, onBeforeFlip) {
  resetCard(cardId);
  if (typeof onBeforeFlip === 'function') onBeforeFlip();
  setTimeout(() => flipCard(cardId), 50);
}

// ============================================================
// モーダル
// ============================================================

const modal = {
  overlay: null,
  confirmBtn: null,
  cancelBtn: null,
  onConfirm: null,

  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.confirmBtn = document.getElementById('modal-confirm');
    this.cancelBtn = document.getElementById('modal-cancel');

    this.confirmBtn.addEventListener('click', () => {
      if (typeof this.onConfirm === 'function') this.onConfirm();
      this.hide();
    });

    this.cancelBtn.addEventListener('click', () => this.hide());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('is-visible')) {
        this.hide();
      }
    });
  },

  show(message, onConfirm) {
    document.getElementById('modal-message').textContent = message;
    this.onConfirm = onConfirm;
    this.overlay.classList.add('is-visible');
    this.overlay.setAttribute('aria-hidden', 'false');
    // フォーカスを確認ボタンへ
    setTimeout(() => this.confirmBtn.focus(), 50);
  },

  hide() {
    this.overlay.classList.remove('is-visible');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.onConfirm = null;
  }
};

// ============================================================
// タブ切り替え
// ============================================================

function resetTabState(tab) {
  if (tab === 'english') {
    state.english.current = null;
    state.english.flipped = false;
    resetCard('english-card');
    const topicEl = document.getElementById('english-topic');
    const ngEl = document.getElementById('english-ngwords');
    if (topicEl) topicEl.textContent = '';
    if (ngEl) ngEl.textContent = '';
    setStatus('english-status', '');
  }

  if (tab === 'turtle') {
    state.turtle.current = null;
    state.turtle.questionRevealed = false;
    state.turtle.answerRevealed = false;

    const qEl = document.getElementById('turtle-question-display');
    if (qEl) {
      qEl.textContent = '「問題を引く」を押すと、ここに問題文が表示されます。';
      qEl.classList.add('is-empty');
    }

    const wrapperEl = document.getElementById('turtle-answer-wrapper');
    if (wrapperEl) {
      wrapperEl.classList.remove('is-revealed');
      wrapperEl.setAttribute('aria-hidden', 'true');
    }
    const aEl = document.getElementById('turtle-answer');
    if (aEl) aEl.textContent = '';

    const revealBtn = document.getElementById('btn-reveal-turtle');
    if (revealBtn) revealBtn.disabled = true;

    setStatus('turtle-status', '');
  }

  if (tab === 'wordwolf') {
    state.wordwolf.flipped = false;
    state.wordwolf.result = null;
    resetCard('wordwolf-card');

    const badgeEl = document.getElementById('ww-role-badge');
    const topicEl = document.getElementById('ww-topic');
    if (badgeEl) { badgeEl.textContent = ''; badgeEl.className = 'role-badge'; }
    if (topicEl) topicEl.textContent = '';

    setStatus('wordwolf-status', '');
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      if (targetTab === state.activeTab) return;

      // 離れるタブの状態をリセット（揮発性）
      resetTabState(state.activeTab);

      // タブボタンの active 切り替え
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      // パネルの表示切り替え
      document.querySelectorAll('.game-panel').forEach(p => {
        p.classList.remove('active');
        p.hidden = true;
      });
      const targetPanel = document.getElementById('panel-' + targetTab);
      if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.hidden = false;
      }

      state.activeTab = targetTab;
    });
  });
}

// ============================================================
// ゲームA: 英語限定説明
// ============================================================

function initEnglishGame() {
  const btn = document.getElementById('btn-draw-english');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const topics = state.data?.english;
    if (!topics || topics.length === 0) {
      setStatus('english-status', 'お題データがありません', 'error');
      return;
    }

    const picked = topics[Math.floor(Math.random() * topics.length)];

    const doFlip = () => {
      document.getElementById('english-topic').textContent = picked.topic;
      const ng = picked.ngwords.split(',').map(w => w.trim()).join(' ／ ');
      document.getElementById('english-ngwords').textContent = ng;
    };

    if (state.english.flipped) {
      reflipCard('english-card', doFlip);
    } else {
      doFlip();
      flipCard('english-card');
    }

    state.english.current = picked;
    state.english.flipped = true;
    setStatus('english-status', '');
  });
}

// ============================================================
// ゲームB: ウミガメのスープ
// ============================================================

function initTurtleGame() {
  const btnDraw   = document.getElementById('btn-draw-turtle');
  const btnReveal = document.getElementById('btn-reveal-turtle');
  if (!btnDraw || !btnReveal) return;

  btnDraw.addEventListener('click', () => {
    const questions = state.data?.turtle;
    if (!questions || questions.length === 0) {
      setStatus('turtle-status', '問題データがありません', 'error');
      return;
    }

    const picked = questions[Math.floor(Math.random() * questions.length)];
    state.turtle.current          = picked;
    state.turtle.questionRevealed = true;

    // 問題文エリアを更新
    const qEl = document.getElementById('turtle-question-display');
    if (qEl) {
      qEl.textContent = picked.question;
      qEl.classList.remove('is-empty');
    }

    // 真相テキストをセット（まだ非表示）
    const aEl = document.getElementById('turtle-answer');
    if (aEl) aEl.textContent = picked.answer;

    // 真相エリアが開いていれば閉じる
    if (state.turtle.answerRevealed) {
      const wrapperEl = document.getElementById('turtle-answer-wrapper');
      if (wrapperEl) {
        wrapperEl.classList.remove('is-revealed');
        wrapperEl.setAttribute('aria-hidden', 'true');
      }
      state.turtle.answerRevealed = false;
    }

    btnReveal.disabled = false;
    setStatus('turtle-status', '問題を引きました。出題者は「答えを見る」で真相を確認できます。');
  });

  btnReveal.addEventListener('click', () => {
    if (!state.turtle.current || state.turtle.answerRevealed) return;

    modal.show(
      '出題者として真相を確認します。\n他のプレイヤーから画面を隠してから「確認・表示する」を押してください。',
      () => {
        // フェードイン＋スライド展開
        const wrapperEl = document.getElementById('turtle-answer-wrapper');
        if (wrapperEl) {
          wrapperEl.classList.add('is-revealed');
          wrapperEl.setAttribute('aria-hidden', 'false');
        }
        state.turtle.answerRevealed = true;
        btnReveal.disabled = true;
        setStatus('turtle-status', '真相を表示しています。ゲーム終了後にタブを切り替えるとリセットされます。');
      }
    );
  });
}

// ============================================================
// ゲームC: ワードウルフ（シード付き乱数で同期）
// ============================================================

function initWordWolfGame() {
  const btn = document.getElementById('btn-check-wordwolf');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const topics = state.data?.wordwolf;
    if (!topics || topics.length === 0) {
      setStatus('wordwolf-status', 'お題データがありません', 'error');
      return;
    }

    // 入力値の取得
    const keyword = document.getElementById('ww-keyword').value.trim();
    const round = parseInt(document.getElementById('ww-round').value, 10);
    const myNum = parseInt(document.getElementById('ww-mynum').value, 10);
    const total = parseInt(document.getElementById('ww-total').value, 10);

    // バリデーション
    if (!keyword) {
      setStatus('wordwolf-status', '合言葉を入力してください', 'error');
      return;
    }
    if (isNaN(round) || round < 1) {
      setStatus('wordwolf-status', '回戦数は1以上の整数を入力してください', 'error');
      return;
    }
    if (isNaN(total) || total < 2) {
      setStatus('wordwolf-status', '総人数は2以上の整数を入力してください', 'error');
      return;
    }
    if (isNaN(myNum) || myNum < 1 || myNum > total) {
      setStatus('wordwolf-status', `プレイヤー番号は 1〜${total} の整数を入力してください`, 'error');
      return;
    }

    // ─── シード付き乱数でお題とウルフを決定 ─────────────────────
    // seed: 合言葉 + 回戦数 の組み合わせ → 全員が同じ結果になる
    const seed = djb2Hash(keyword + String(round));
    const random = mulberry32(seed);

    const topicIndex = Math.floor(random() * topics.length); // お題インデックス
    const wolfPlayer = Math.floor(random() * total) + 1;     // ウルフのプレイヤー番号 (1〜N)
    // ─────────────────────────────────────────────────────────────

    const picked = topics[topicIndex];
    const isWolf = (myNum === wolfPlayer);
    const myTopic = isWolf ? picked.wolf : picked.citizen;

    state.wordwolf.result = { isWolf, topic: myTopic };

    const doFlip = () => {
      const badgeEl = document.getElementById('ww-role-badge');
      const topicEl = document.getElementById('ww-topic');
      if (badgeEl) {
        badgeEl.textContent = isWolf ? 'ウルフ' : '市民';
        badgeEl.className = 'role-badge ' + (isWolf ? 'is-wolf' : 'is-citizen');
      }
      if (topicEl) topicEl.textContent = myTopic;
    };

    if (state.wordwolf.flipped) {
      reflipCard('wordwolf-card', doFlip);
    } else {
      doFlip();
      flipCard('wordwolf-card');
    }

    state.wordwolf.flipped = true;
    setStatus('wordwolf-status', `シード: ${seed} ／ ウルフ: ${wolfPlayer}番`);
  });
}

// ============================================================
// 初期化
// ============================================================

async function init() {
  // モーダルとタブを先に初期化
  modal.init();
  initTabs();

  // ローディング表示
  ['english', 'turtle', 'wordwolf'].forEach(tab => {
    setStatus(tab + '-status', 'データを読み込み中...', 'loading');
  });

  // データ取得
  await loadData();

  // ローディング解除
  ['english', 'turtle', 'wordwolf'].forEach(tab => {
    setStatus(tab + '-status', '');
  });

  // データソースバッジ更新
  renderDataSourceBadge();

  // 各ゲーム初期化
  initEnglishGame();
  initTurtleGame();
  initWordWolfGame();
}

document.addEventListener('DOMContentLoaded', init);
