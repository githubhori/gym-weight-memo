// データ保存モジュール。保存方式を変えるときはこのファイルだけ直す。
// 現在は localStorage に1つのJSONとして保存する。
var Store = (function () {
  'use strict';

  var KEY = 'gymweight.data';
  var SCHEMA_VERSION = 1;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var state = load();

  function emptyState() {
    return { machines: [], weightHistory: [], lastBackupAt: null };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return emptyState();
      var d = JSON.parse(raw);
      return {
        machines: Array.isArray(d.machines) ? d.machines : [],
        weightHistory: Array.isArray(d.weightHistory) ? d.weightHistory : [],
        lastBackupAt: typeof d.lastBackupAt === 'string' ? d.lastBackupAt : null
      };
    } catch (e) {
      return emptyState();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      machines: state.machines,
      weightHistory: state.weightHistory,
      lastBackupAt: state.lastBackupAt
    }));
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // 端末のローカル日付（YYYY-MM-DD）。toISOString はUTCなので使わない。
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function isValidWeight(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 500 && Math.round(v * 2) / 2 === v;
  }

  function isValidDate(s) {
    if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
    var p = s.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }

  function formatWeight(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  function getMachines() {
    return state.machines.slice().sort(function (a, b) { return a.order - b.order; });
  }

  function getMachine(id) {
    for (var i = 0; i < state.machines.length; i++) {
      if (state.machines[i].id === id) return state.machines[i];
    }
    return null;
  }

  function getHistory(id) {
    return state.weightHistory
      .filter(function (r) { return r.machineId === id; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  // 現在のウエイト = 日付が最新の履歴。なければ null。
  function currentWeight(id) {
    var h = getHistory(id);
    return h.length ? h[0].weightKg : null;
  }

  // 今日の日付で記録。同一マシン・同一日付は上書き。
  function recordWeight(id, kg) {
    var t = today();
    var found = false;
    state.weightHistory.forEach(function (r) {
      if (r.machineId === id && r.date === t) { r.weightKg = kg; found = true; }
    });
    if (!found) state.weightHistory.push({ machineId: id, date: t, weightKg: kg });
  }

  function addMachine(fields) {
    var max = -1;
    state.machines.forEach(function (m) { if (m.order > max) max = m.order; });
    var m = {
      id: uuid(),
      name: fields.name,
      muscle: fields.muscle || '',
      memo: fields.memo || '',
      order: max + 1
    };
    state.machines.push(m);
    if (fields.weightKg != null) recordWeight(m.id, fields.weightKg);
    save();
    return m;
  }

  // weightKg が null（空欄）なら履歴は触らない。現在値と同じでも追加しない。
  function updateMachine(id, fields) {
    var m = getMachine(id);
    if (!m) return;
    m.name = fields.name;
    m.muscle = fields.muscle || '';
    m.memo = fields.memo || '';
    if (fields.weightKg != null && fields.weightKg !== currentWeight(id)) {
      recordWeight(id, fields.weightKg);
    }
    save();
  }

  function deleteMachine(id) {
    state.machines = state.machines.filter(function (m) { return m.id !== id; });
    state.weightHistory = state.weightHistory.filter(function (r) { return r.machineId !== id; });
    save();
  }

  function moveMachine(id, dir) {
    var list = getMachines();
    var i = list.findIndex(function (m) { return m.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    list.forEach(function (m, n) { m.order = n; });
    save();
  }

  function deleteHistory(id, date) {
    state.weightHistory = state.weightHistory.filter(function (r) {
      return !(r.machineId === id && r.date === date);
    });
    save();
  }

  function exportData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      machines: getMachines(),
      weightHistory: state.weightHistory.slice()
    };
  }

  // 検証のみ。問題があればエラー文字列、なければ null。
  function validateImport(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return 'ファイルの形式が正しくありません。';
    if (d.schemaVersion !== SCHEMA_VERSION) return 'このバージョンのバックアップではありません。';
    if (typeof d.exportedAt !== 'string') return 'exportedAt がありません。';
    if (!Array.isArray(d.machines) || !Array.isArray(d.weightHistory)) return 'machines / weightHistory がありません。';
    var ids = {};
    for (var i = 0; i < d.machines.length; i++) {
      var m = d.machines[i];
      if (!m || typeof m !== 'object') return 'マシン ' + (i + 1) + ' 件目が不正です。';
      if (typeof m.id !== 'string' || !m.id) return 'マシン ' + (i + 1) + ' 件目のIDが不正です。';
      if (ids[m.id]) return 'マシンIDが重複しています。';
      ids[m.id] = true;
      if (typeof m.name !== 'string' || !m.name.trim()) return 'マシン ' + (i + 1) + ' 件目の名前が不正です。';
      if (typeof m.muscle !== 'string' || typeof m.memo !== 'string') return 'マシン ' + (i + 1) + ' 件目の項目が不正です。';
      if (typeof m.order !== 'number' || !isFinite(m.order)) return 'マシン ' + (i + 1) + ' 件目の順序が不正です。';
    }
    var seen = {};
    for (var k = 0; k < d.weightHistory.length; k++) {
      var r = d.weightHistory[k];
      if (!r || typeof r !== 'object') return '履歴 ' + (k + 1) + ' 件目が不正です。';
      if (!ids[r.machineId]) return '履歴 ' + (k + 1) + ' 件目が存在しないマシンを指しています。';
      if (!isValidDate(r.date)) return '履歴 ' + (k + 1) + ' 件目の日付が不正です。';
      if (!isValidWeight(r.weightKg)) return '履歴 ' + (k + 1) + ' 件目のウエイトが不正です。';
      var key = r.machineId + '|' + r.date;
      if (seen[key]) return '同じマシン・同じ日付の履歴が重複しています。';
      seen[key] = true;
    }
    return null;
  }

  // 全置換。事前に validateImport を通すこと。
  function replaceAll(d) {
    var backup = state;
    state = {
      machines: d.machines.map(function (m) {
        return { id: m.id, name: m.name, muscle: m.muscle, memo: m.memo, order: m.order };
      }),
      weightHistory: d.weightHistory.map(function (r) {
        return { machineId: r.machineId, date: r.date, weightKg: r.weightKg };
      }),
      lastBackupAt: backup.lastBackupAt
    };
    try { save(); } catch (e) { state = backup; throw e; }
  }

  function getLastBackupAt() { return state.lastBackupAt; }

  function markBackup() {
    state.lastBackupAt = new Date().toISOString();
    save();
  }

  return {
    today: today,
    isValidWeight: isValidWeight,
    formatWeight: formatWeight,
    getMachines: getMachines,
    getMachine: getMachine,
    getHistory: getHistory,
    currentWeight: currentWeight,
    addMachine: addMachine,
    updateMachine: updateMachine,
    deleteMachine: deleteMachine,
    moveMachine: moveMachine,
    deleteHistory: deleteHistory,
    exportData: exportData,
    validateImport: validateImport,
    replaceAll: replaceAll,
    getLastBackupAt: getLastBackupAt,
    markBackup: markBackup
  };
})();
