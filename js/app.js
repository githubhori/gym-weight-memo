// 画面の組み立てとルーティング。ユーザー入力は必ず textContent で表示する（innerHTML 不使用）。
(function () {
  'use strict';

  var app = document.getElementById('app');
  var NS = 'http://www.w3.org/2000/svg';
  var BACKUP_WARN_DAYS = 30;

  // マシン名は全角 NAME_CHARS 文字が1行に収まる大きさにする（style.css の --fs-*-name が上限）
  var NAME_CHARS = 11;
  var NAME_MIN_SCALE = 0.75;

  // ---------- DOM ヘルパー ----------
  function h(tag, attrs) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function svg(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) e.appendChild(arguments[i]);
    return e;
  }

  // 線のアイコン（絵文字は使わない）
  function icon(kind) {
    var paths = {
      left: 'M15 5l-7 7 7 7',
      up: 'M5 15l7-7 7 7',
      down: 'M5 9l7 7 7-7'
    };
    return svg('svg', {
      viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor',
      'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
    }, svg('path', { d: paths[kind] }));
  }

  function mount(node) {
    app.textContent = '';
    app.appendChild(node);
  }

  function showError(box, msg) { box.textContent = msg; }

  // ---------- 自動縮小 ----------
  var refits = [];

  // 全角 NAME_CHARS 文字を実際に描画して幅を測り、avail に収まる倍率（最大1）を返す。
  // 端末の文字サイズ設定で拡大されていても、実測なので正しく補正できる。
  function fitScale(host, sizeVar, weight, avail) {
    var probe = h('span', { text: new Array(NAME_CHARS + 1).join('国'), style:
      'position:absolute;visibility:hidden;white-space:nowrap;font-weight:' + weight + ';font-size:var(' + sizeVar + ')' });
    host.appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    probe.remove();
    return w > avail ? avail / w * 0.98 : 1;
  }

  // 詳細画面のマシン名: 1行 NAME_CHARS 文字。長い名前は2行まで折り返し、3行以上なら更に縮小
  function fitName(el) {
    var scale = fitScale(el.parentNode, '--fs-detail-name', 800, el.clientWidth);
    var min = scale * NAME_MIN_SCALE;
    function apply() { el.style.setProperty('--name-scale', scale.toFixed(4)); }
    function lines() { return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)); }
    apply();
    while (lines() > 2 && scale > min) { scale -= 0.03; apply(); }
  }

  // 一覧のマシン名と対象筋肉: 同じ倍率で縮める（筋肉名が常にマシン名より小さくなる）
  function fitListNames(view) {
    var scale = fitScale(view, '--fs-list-name', 700, view.clientWidth - 40); // 行の左右余白 20px ずつ
    view.style.setProperty('--list-scale', scale.toFixed(4));
  }

  function runRefits() { refits.forEach(function (f) { f(); }); }
  window.addEventListener('resize', runRefits);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(runRefits);

  // ---------- ルーティング ----------
  function go(hash) { location.hash = hash; }

  function render() {
    refits = [];
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var id = parts[1] ? decodeURIComponent(parts[1]) : null;
    window.scrollTo(0, 0);
    switch (parts[0]) {
      case 'm': return viewDetail(id);
      case 'edit':
        if (id === 'new') return viewForm(null);
        if (id) return viewForm(id, parts[2] === 'm'); // #/edit/<id>/m = 詳細画面から開いた編集
        return viewEdit();
      case 'history': return id ? viewHistoryOf(id) : viewHistoryPick();
      case 'backup': return viewBackup();
      default: return viewList();
    }
  }

  // ---------- バナー（ダンベルのマーク＋タイトル） ----------
  function banner() {
    var yellow = 'var(--accent)';
    var s = svg('svg', { class: 'banner', viewBox: '0 0 387 96', 'aria-hidden': 'true' });
    // ホーム画面アイコンと同じ形のダンベル（100x100 の枠を 0.92 倍）
    var g = svg('g', { transform: 'translate(0 2) scale(0.92)', fill: yellow });
    g.appendChild(svg('rect', { x: 28, y: 46, width: 44, height: 8 }));
    [[8, 30, 12, 40], [20, 22, 12, 56], [68, 22, 12, 56], [80, 30, 12, 40]].forEach(function (r) {
      g.appendChild(svg('rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 3 }));
    });
    s.appendChild(g);
    function label(txt, y, size, fill, spacing) {
      var t = svg('text', { x: 104, y: y, 'font-size': size, 'font-weight': 900, fill: fill, 'letter-spacing': spacing });
      t.textContent = txt;
      s.appendChild(t);
    }
    label('GYM', 52, 46, 'var(--fg)', 0);
    label('WEIGHT MEMO', 82, 24, yellow, 3);
    return s;
  }

  // ---------- 一覧 ----------
  function backupStale() {
    if (!Store.getMachines().length) return false;
    var last = Store.getLastBackupAt();
    if (!last) return true;
    return (Date.now() - new Date(last).getTime()) / 86400000 >= BACKUP_WARN_DAYS;
  }

  function viewList() {
    var machines = Store.getMachines();
    var header = h('div', { class: 'list-header' },
      h('h1', { class: 'app-title', 'aria-label': 'Gym Weight Memo' }, banner()),
      h('div', { class: 'nav' },
        h('a', { class: 'btn', href: '#/history', text: '履歴' }),
        h('a', { class: 'btn', href: '#/edit', text: '編集' }),
        h('a', { class: 'btn', href: '#/backup', text: 'バックアップ' })
      ),
      backupStale() ? h('p', { class: 'notice', text: Store.getLastBackupAt()
        ? '最後のバックアップから30日以上たっています。'
        : 'まだバックアップがありません。' }) : null
    );

    var body;
    if (!machines.length) {
      body = h('div', { class: 'empty', text: '「編集」からマシンを追加してください。' });
    } else {
      body = h('div', { class: 'rows' });
      machines.forEach(function (m) {
        var w = Store.currentWeight(m.id);
        var weightEl = h('div', { class: 'row-weight' });
        if (w == null) {
          weightEl.appendChild(h('span', { class: 'num', text: '未設定', style: 'font-size:28px' }));
        } else {
          weightEl.appendChild(h('span', { class: 'num', text: Store.formatWeight(w) }));
          weightEl.appendChild(h('span', { class: 'unit', text: 'kg' }));
        }
        body.appendChild(h('a', { class: 'row', href: '#/m/' + encodeURIComponent(m.id) },
          h('div', { class: 'row-name', text: m.name }),
          h('div', { class: 'row-sub' },
            h('div', { class: 'row-muscle', text: m.muscle }),
            weightEl)
        ));
      });
    }
    var view = h('div', { class: 'list-view' }, header, body);
    mount(view);
    var fit = function () { fitListNames(view); };
    fit();
    refits.push(fit);
  }

  // ---------- 詳細 ----------
  function viewDetail(id) {
    var m = Store.getMachine(id);
    if (!m) { location.replace('#/'); return; }
    var nameEl = h('h1', { class: 'detail-name', text: m.name });

    var view = h('div', { class: 'detail-view' },
      h('a', { class: 'btn back-btn', href: '#/' }, icon('left'), '一覧に戻る'),
      h('div', { class: 'detail-head' }, nameEl,
        h('div', { class: 'detail-sub' },
          h('div', { class: 'detail-muscle', text: m.muscle }),
          h('a', { class: 'btn detail-edit', href: '#/edit/' + encodeURIComponent(m.id) + '/m', text: '編集' }))),
      h('div', { class: 'memo-box' },
        h('div', { class: 'memo-label', text: 'メモ' }),
        h('div', { class: 'memo-text', text: m.memo }))
    );
    mount(view);

    var fit = function () { fitName(nameEl); };
    fit();
    refits.push(fit);
  }

  // ---------- 編集（一覧） ----------
  function viewEdit() {
    var scroll = window.scrollY;
    var machines = Store.getMachines();
    var list = h('div');
    if (!machines.length) list.appendChild(h('p', { class: 'muted', text: 'マシンがまだありません。' }));

    machines.forEach(function (m, i) {
      var w = Store.currentWeight(m.id);
      list.appendChild(h('div', { class: 'edit-item' },
        h('div', { class: 'nm', text: m.name }),
        h('div', { class: 'sub', text: (m.muscle ? m.muscle + ' / ' : '') + (w == null ? '未設定' : Store.formatWeight(w) + ' kg') }),
        h('div', { class: 'edit-actions' },
          h('a', { class: 'btn grow', href: '#/edit/' + encodeURIComponent(m.id), text: '編集' }),
          h('button', { class: 'btn danger grow', type: 'button', text: '削除', onclick: function () {
            if (!confirm('「' + m.name + '」を削除しますか？\nウエイトの履歴も削除されます。')) return;
            Store.deleteMachine(m.id);
            viewEdit();
          } }),
          h('button', { class: 'btn', type: 'button', 'aria-label': '上へ', disabled: i === 0,
            onclick: function () { Store.moveMachine(m.id, -1); viewEdit(); } }, icon('up')),
          h('button', { class: 'btn', type: 'button', 'aria-label': '下へ', disabled: i === machines.length - 1,
            onclick: function () { Store.moveMachine(m.id, 1); viewEdit(); } }, icon('down'))
        )
      ));
    });

    mount(h('div', { class: 'page' },
      h('div', { class: 'topbar' }, h('a', { class: 'btn', href: '#/' }, icon('left'), '一覧に戻る')),
      h('h1', { text: 'マシンの編集' }),
      h('a', { class: 'btn primary block', href: '#/edit/new', text: 'マシンを追加' }),
      h('div', { style: 'height:20px' }),
      list
    ));
    window.scrollTo(0, scroll);
  }

  // ---------- 編集（フォーム） ----------
  function parseWeight(text) {
    var t = text.trim().replace(/[０-９．]/g, function (c) {
      return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    });
    if (t === '') return { value: null };
    if (!/^\d+(\.\d+)?$/.test(t)) return { error: 'ウエイトは数字で入力してください。' };
    var v = Number(t);
    if (v < 0 || v > 500) return { error: 'ウエイトは0〜500kgの範囲で入力してください。' };
    if (!Store.isValidWeight(v)) return { error: 'ウエイトは0.5kg刻みで入力してください。' };
    return { value: v };
  }

  // fromDetail: 詳細画面から開いた編集。保存・キャンセル後は詳細画面に戻る。
  function viewForm(id, fromDetail) {
    var m = id ? Store.getMachine(id) : null;
    if (id && !m) { location.replace('#/edit'); return; }
    var backHash = fromDetail ? '#/m/' + encodeURIComponent(id) : '#/edit';

    // 詳細画面から来たときは履歴を1つ戻る（同じ画面が履歴に二重に残らないように）
    function leave() {
      if (fromDetail && history.length > 1) history.back();
      else location.replace(backHash);
    }
    function onBack(e) { e.preventDefault(); leave(); }
    var cur = m ? Store.currentWeight(m.id) : null;

    var name = h('input', { id: 'f-name', type: 'text', value: m ? m.name : '', autocomplete: 'off' });
    var muscle = h('input', { id: 'f-muscle', type: 'text', value: m ? m.muscle : '', autocomplete: 'off' });
    var weight = h('input', { id: 'f-weight', type: 'text', inputmode: 'decimal', autocomplete: 'off',
      value: cur == null ? '' : Store.formatWeight(cur), placeholder: '例: 22.5' });
    var memo = h('textarea', { id: 'f-memo' });
    memo.value = m ? m.memo : '';
    var err = h('div', { class: 'error', role: 'alert' });

    function submit() {
      var n = name.value.trim();
      var msgs = [];
      if (!n) msgs.push('マシン名を入力してください。');
      var w = parseWeight(weight.value);
      if (w.error) msgs.push(w.error);
      if (msgs.length) { showError(err, msgs.join('\n')); return; }
      var fields = { name: n, muscle: muscle.value.trim(), memo: memo.value, weightKg: w.value };
      try {
        if (m) Store.updateMachine(m.id, fields); else Store.addMachine(fields);
      } catch (e) {
        showError(err, '保存できませんでした（端末の容量を確認してください）。');
        return;
      }
      leave();
    }

    mount(h('div', { class: 'page' },
      h('div', { class: 'topbar' }, h('a', { class: 'btn', href: backHash, onclick: onBack }, icon('left'), '戻る')),
      h('h1', { text: m ? 'マシンを編集' : 'マシンを追加' }),
      h('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); submit(); } },
        h('div', { class: 'field' }, h('label', { for: 'f-name', text: 'マシン名（必須）' }), name),
        h('div', { class: 'field' }, h('label', { for: 'f-muscle', text: '対象筋肉' }), muscle),
        h('div', { class: 'field' }, h('label', { for: 'f-weight', text: 'ウエイト（kg・0.5刻み・空欄可）' }), weight),
        h('div', { class: 'field' }, h('label', { for: 'f-memo', text: 'メモ' }), memo),
        err,
        h('div', { class: 'form-actions' },
          h('a', { class: 'btn', href: backHash, onclick: onBack, text: 'キャンセル' }),
          h('button', { class: 'btn primary', type: 'submit', text: '保存' }))
      )
    ));
  }

  // ---------- 履歴 ----------
  function viewHistoryPick() {
    var machines = Store.getMachines();
    var list = h('div');
    if (!machines.length) list.appendChild(h('p', { class: 'muted', text: 'マシンがまだありません。' }));
    machines.forEach(function (m) {
      list.appendChild(h('a', { class: 'btn block', style: 'justify-content:flex-start;margin-bottom:10px;text-align:left',
        href: '#/history/' + encodeURIComponent(m.id), text: m.name }));
    });
    mount(h('div', { class: 'page' },
      h('div', { class: 'topbar' }, h('a', { class: 'btn', href: '#/' }, icon('left'), '一覧に戻る')),
      h('h1', { text: '履歴' }),
      h('p', { class: 'muted', text: 'マシンを選んでください。' }),
      list
    ));
  }

  function chartSvg(rows) {
    // rows: 日付の古い順
    var W = 360, H = 220, L = 44, R = 12, T = 14, B = 30;
    var t = rows.map(function (r) { var p = r.date.split('-'); return new Date(+p[0], p[1] - 1, +p[2]).getTime(); });
    var vals = rows.map(function (r) { return r.weightKg; });
    var minV = Math.min.apply(null, vals), maxV = Math.max.apply(null, vals);
    if (minV === maxV) { minV -= 1; maxV += 1; }
    var pad = (maxV - minV) * 0.1; minV -= pad; maxV += pad;
    var t0 = t[0], t1 = t[t.length - 1];
    function x(i) { return L + (t1 === t0 ? 0 : (t[i] - t0) / (t1 - t0)) * (W - L - R); }
    function y(v) { return T + (1 - (v - minV) / (maxV - minV)) * (H - T - B); }

    var s = svg('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'ウエイト推移のグラフ' });
    s.appendChild(svg('line', { x1: L, y1: T, x2: L, y2: H - B, stroke: 'currentColor', 'stroke-opacity': 0.35 }));
    s.appendChild(svg('line', { x1: L, y1: H - B, x2: W - R, y2: H - B, stroke: 'currentColor', 'stroke-opacity': 0.35 }));
    function label(txt, lx, ly, anchor) {
      var el = svg('text', { x: lx, y: ly, 'text-anchor': anchor });
      el.textContent = txt;
      s.appendChild(el);
    }
    label(Store.formatWeight(Math.round(maxV * 2) / 2), L - 6, T + 10, 'end');
    label(Store.formatWeight(Math.round(minV * 2) / 2), L - 6, H - B, 'end');
    label(rows[0].date, L, H - 8, 'start');
    label(rows[rows.length - 1].date, W - R, H - 8, 'end');

    var pts = rows.map(function (r, i) { return x(i).toFixed(1) + ',' + y(r.weightKg).toFixed(1); }).join(' ');
    s.appendChild(svg('polyline', { points: pts, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    rows.forEach(function (r, i) {
      s.appendChild(svg('circle', { cx: x(i).toFixed(1), cy: y(r.weightKg).toFixed(1), r: 4, fill: 'var(--accent)' }));
    });
    return s;
  }

  function viewHistoryOf(id) {
    var m = Store.getMachine(id);
    if (!m) { location.replace('#/history'); return; }
    var scroll = window.scrollY;
    var rows = Store.getHistory(id); // 新しい順

    var chartArea;
    if (rows.length <= 1) {
      chartArea = h('p', { class: 'muted', text: '履歴が1件以下のため、グラフは表示しません。' });
    } else {
      chartArea = chartSvg(rows.slice().reverse());
    }

    var table;
    if (!rows.length) {
      table = h('p', { class: 'muted', text: '履歴はまだありません。' });
    } else {
      var tbody = h('tbody');
      rows.forEach(function (r) {
        tbody.appendChild(h('tr', null,
          h('td', { text: r.date }),
          h('td', { class: 'w', text: Store.formatWeight(r.weightKg) + ' kg' }),
          h('td', { class: 'del' }, h('button', { class: 'btn danger', type: 'button', text: '削除', onclick: function () {
            if (!confirm(r.date + '（' + Store.formatWeight(r.weightKg) + ' kg）の記録を削除しますか？')) return;
            Store.deleteHistory(id, r.date);
            viewHistoryOf(id);
          } }))
        ));
      });
      table = h('table', { class: 'hist' },
        h('thead', null, h('tr', null, h('th', { text: '日付' }), h('th', { text: 'ウエイト' }), h('th'))),
        tbody);
    }

    mount(h('div', { class: 'page' },
      h('div', { class: 'topbar' }, h('a', { class: 'btn', href: '#/history' }, icon('left'), '戻る')),
      h('h1', { text: m.name }),
      chartArea,
      table
    ));
    window.scrollTo(0, scroll);
  }

  // ---------- バックアップ ----------
  function two(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDateTime(iso) {
    var d = new Date(iso);
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }

  function viewBackup() {
    var msg = h('div', { role: 'status' });
    function say(text, cls) { msg.className = cls; msg.textContent = text; }
    var last = Store.getLastBackupAt();
    var lastEl = h('p', { text: '最終バックアップ: ' + (last ? fmtDateTime(last) : 'まだありません') });

    function doExport() {
      var data = Store.exportData();
      var d = new Date();
      var fname = 'gym-weight-backup-' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '.json';
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var file = new File([blob], fname, { type: 'application/json' });
      function done() {
        Store.markBackup();
        lastEl.textContent = '最終バックアップ: ' + fmtDateTime(Store.getLastBackupAt());
        say('書き出しました: ' + fname, 'ok');
      }
      function download() {
        var url = URL.createObjectURL(blob);
        var a = h('a', { href: url, download: fname });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        done();
      }
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: fname }).then(done).catch(function (e) {
          if (e && e.name === 'AbortError') return; // ユーザーが共有をやめた
          download();
        });
      } else {
        download();
      }
    }

    var fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'imp',
      onchange: function () {
        var f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!f) return;
        f.text().then(function (txt) {
          var data;
          try { data = JSON.parse(txt); } catch (e) { say('JSONとして読み込めませんでした。既存のデータは変更していません。', 'error'); return; }
          var problem = Store.validateImport(data);
          if (problem) { say('読み込めません: ' + problem + '\n既存のデータは変更していません。', 'error'); return; }
          if (!confirm('現在のデータをすべて置き換えます（マシン ' + data.machines.length + ' 件、履歴 ' + data.weightHistory.length + ' 件）。\nよろしいですか？')) return;
          try { Store.replaceAll(data); } catch (e) { say('保存できませんでした。既存のデータは変更していません。', 'error'); return; }
          say('読み込みました。', 'ok');
        }).catch(function () { say('ファイルを読み込めませんでした。', 'error'); });
      } });

    mount(h('div', { class: 'page' },
      h('div', { class: 'topbar' }, h('a', { class: 'btn', href: '#/' }, icon('left'), '一覧に戻る')),
      h('h1', { text: 'バックアップ' }),
      lastEl,
      h('h2', { text: 'エクスポート' }),
      h('p', { class: 'muted', text: '全データをJSONファイルに書き出します。' }),
      h('button', { class: 'btn primary block', type: 'button', text: '書き出す', onclick: doExport }),
      h('h2', { text: 'インポート' }),
      h('p', { class: 'muted', text: 'バックアップファイルを読み込み、現在のデータをすべて置き換えます。' }),
      fileInput,
      h('label', { class: 'btn block', for: 'imp', text: 'ファイルを選んで読み込む' }),
      msg,
      h('div', { class: 'version', text: 'バージョン: ' + APP_VERSION })
    ));
  }

  // ---------- 起動 ----------
  window.addEventListener('hashchange', render);
  render();

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () {});
  }
})();
