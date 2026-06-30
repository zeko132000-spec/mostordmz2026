// admin.js - Admin panel with Firebase Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

document.getElementById('year').textContent = new Date().getFullYear();

// ============================================================
// 🔒 PASSWORD PROTECTION (SHA-256 — لا يُخزَّن النص الصريح أبداً)
// لتغيير كلمة المرور: احسب SHA-256 للكلمة الجديدة وضعها هنا
// الكلمة الحالية: Zeko#1984
// ============================================================
const ADMIN_PASSWORD_HASH = '7e9de33cc27c9dad71dbb0ac08c370711f10e3047ca031a3c87583e782cdd468';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPassword() {
  const saved = sessionStorage.getItem('admin_auth_hash');
  if (saved && saved === ADMIN_PASSWORD_HASH) {
    document.getElementById('passwordOverlay').style.display = 'none';
    document.getElementById('adminMain').style.display = '';
    return;
  }
  document.getElementById('passwordOverlay').style.display = 'flex';
  document.getElementById('adminMain').style.display = 'none';
}

document.getElementById('pwBtn').addEventListener('click', tryLogin);
document.getElementById('pwInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

async function tryLogin() {
  const val = document.getElementById('pwInput').value;
  const hash = await sha256(val);
  if (hash === ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem('admin_auth_hash', hash);
    document.getElementById('passwordOverlay').style.display = 'none';
    document.getElementById('adminMain').style.display = '';
  } else {
    const err = document.getElementById('pwError');
    err.classList.remove('hidden');
    document.getElementById('pwInput').value = '';
    document.getElementById('pwInput').classList.add('shake');
    setTimeout(() => document.getElementById('pwInput').classList.remove('shake'), 500);
  }
}

checkPassword();


// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD1JPFwUuSIDPboDdavzYsUvYAi-FSxyBk",
  authDomain: "most-556e2.firebaseapp.com",
  databaseURL: "https://most-556e2-default-rtdb.firebaseio.com",
  projectId: "most-556e2",
  storageBucket: "most-556e2.firebasestorage.app",
  messagingSenderId: "648492012045",
  appId: "1:648492012045:web:898291935c005c3801fb44"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let parsedRows = [];
let parsedHeaders = [];

// تنظيف أسماء الأعمدة لتوافق Firebase
// Firebase لا يقبل: مسافات, . # $ / [ ]
function sanitizeKey(key) {
  return String(key)
    .replace(/[.#$\[\]\/\s]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'col';
}

// Status message
function showStatus(msg, type = 'success') {
  const el = document.getElementById('uploadStatus');
  el.textContent = msg;
  el.className = `upload-status ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// Load stored list from Firebase
async function renderStoredList() {
  const list = document.getElementById('storedDataList');
  list.innerHTML = '<div class="empty-state">⏳ جاري التحميل...</div>';
  try {
    let snapshot = await get(ref(db, 'metadata'));
    let data = null;
    if (snapshot.exists()) {
      data = snapshot.val();
    } else {
      snapshot = await get(ref(db, 'datasets'));
      if (snapshot.exists()) {
        data = snapshot.val();
      }
    }
    if (!data) {
      list.innerHTML = '<div class="empty-state">لا توجد بيانات محفوظة بعد</div>';
      return;
    }
    const keys = Object.keys(data);
    list.innerHTML = keys.map(k => {
      const d = data[k];
      return `
        <div class="stored-item">
          <div class="stored-item-info">
            <div class="stored-item-title">📚 ${d.grade} — ${d.term}</div>
            <div class="stored-item-meta">${d.count} طالب | رُفع: ${d.uploadedAt}</div>
          </div>
          <div class="stored-item-actions">
            <button class="delete-item-btn" onclick="deleteDataset('${k}')">🗑️ حذف</button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div class="empty-state" style="color:#ef4444">خطأ في الاتصال: ${e.message}</div>`;
  }
}

// ============================================================
// ✅ Custom Confirm Modal (بديل confirm() للموبايل)
// ============================================================
function showConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const msg   = document.getElementById('confirmMsg');
    const yesBtn = document.getElementById('confirmYesBtn');
    const noBtn  = document.getElementById('confirmNoBtn');
    msg.textContent = message;
    modal.style.display = 'flex';
    const cleanup = (result) => {
      modal.style.display = 'none';
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      resolve(result);
    };
    const onYes = () => cleanup(true);
    const onNo  = () => cleanup(false);
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
  });
}

window.deleteDataset = async function(key) {
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذه البيانات؟ لا يمكن التراجع!');
  if (!confirmed) return;
  try {
    await remove(ref(db, `datasets/${key}`));
    await remove(ref(db, `metadata/${key}`));
    await remove(ref(db, `student_records/${key}`));
    showStatus('تم حذف البيانات بنجاح ✅', 'success');
    renderStoredList();
  } catch(e) {
    const msg = e.message || '';
    if (msg.toLowerCase().includes('permission')) {
      showStatus('❌ خطأ في الحذف: قواعد Firebase لا تسمح بالحذف — افتح Firebase Console واجعل Rules: { ".write": true }', 'error');
    } else {
      showStatus('خطأ في الحذف: ' + e.message, 'error');
    }
  }
};

// File handling
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

document.getElementById('chooseFileBtn').addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (json.length === 0) { showStatus('الملف لا يحتوي على بيانات!', 'error'); return; }
      parsedHeaders = Object.keys(json[0]);
      parsedRows = json;
      document.getElementById('dropContent').innerHTML = `
        <div class="drop-icon">✅</div>
        <h3>${file.name}</h3>
        <p>${parsedRows.length} صف | ${parsedHeaders.length} عمود</p>`;
      renderColumnMapping();
      renderPreview();
      document.getElementById('uploadBtn').classList.remove('hidden');
    } catch(err) { showStatus('خطأ في قراءة الملف: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function renderColumnMapping() {
  const sec = document.getElementById('columnMappingSection');
  const grid = document.getElementById('mappingGrid');
  sec.classList.remove('hidden');
  const fields = [
    { id: 'mapSeat',   label: '🪑 عمود رقم الجلوس' },
    { id: 'mapName',   label: '👤 عمود اسم الطالب' },
    { id: 'mapResult', label: '✅ عمود النتيجة (ناجح/راسب)' },
    { id: 'mapTotal',  label: '🏆 عمود المجموع' },
    { id: 'mapGrade',  label: '⭐ عمود التقدير' },
  ];
  const options = ['<option value="">-- لا يوجد --</option>',
    ...parsedHeaders.map(h => `<option value="${h}">${h}</option>`)].join('');
  grid.innerHTML = fields.map(f => `
    <div class="mapping-item">
      <label>${f.label}</label>
      <select id="${f.id}">${options}</select>
    </div>`).join('');
  const autoMap = {
    mapSeat:   ['رقم الجلوس','seat','جلوس','رقم جلوس'],
    mapName:   ['اسم الطالب','name','الاسم','اسم'],
    mapResult: ['النتيجة','result','القرار','الحكم'],
    mapTotal:  ['المجموع','total','الإجمالي','مجموع','المجموع الكلى'],
    mapGrade:  ['التقدير','grade','المرتبة','تقدير'],
  };
  Object.entries(autoMap).forEach(([id, variants]) => {
    const match = parsedHeaders.find(h => variants.some(v => h.trim().toLowerCase().includes(v.toLowerCase())));
    if (match) document.getElementById(id).value = match;
  });
}

function renderPreview() {
  const sec = document.getElementById('previewSection');
  const table = document.getElementById('previewTable');
  sec.classList.remove('hidden');
  document.getElementById('previewCount').textContent = `${parsedRows.length} طالب`;
  const preview = parsedRows.slice(0, 8);
  let html = `<thead><tr>${parsedHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  preview.forEach(row => { html += `<tr>${parsedHeaders.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`; });
  html += '</tbody>';
  table.innerHTML = html;
}

// Save to Firebase
document.getElementById('uploadForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (parsedRows.length === 0) { showStatus('يرجى اختيار ملف أولاً', 'error'); return; }
  const grade = document.getElementById('uploadGrade').value.trim();
  const term = document.getElementById('uploadTerm').value;
  if (!grade) { showStatus('يرجى إدخال اسم الصف', 'error'); return; }
  const seatCol = document.getElementById('mapSeat').value;
  if (!seatCol) { showStatus('يرجى تحديد عمود رقم الجلوس', 'error'); return; }

  const nameCol    = document.getElementById('mapName').value;
  const resultCol  = document.getElementById('mapResult').value;
  const totalCol   = document.getElementById('mapTotal').value;
  const gradeValCol= document.getElementById('mapGrade').value;

  // Detect subject columns (numeric, not used)
  const usedCols = new Set([seatCol, nameCol, resultCol, totalCol, gradeValCol].filter(Boolean));
  // أعمدة يجب استبعادها دائماً حتى لو قيمها أرقام (أرقام تسلسلية، نسب مئوية)
  const excludePatterns = /^(م|ن|م\s*\d|ن\s*\d|رقم|serial|no\.|#)$/i;
  const subjectCols = parsedHeaders.filter(h => !usedCols.has(h)).filter(h => {
    if (excludePatterns.test(h.trim())) return false;
    const vals = parsedRows.map(r => r[h]).filter(v => v !== '');
    const numericVals = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (numericVals.length <= vals.length * 0.5) return false;
    // استبعاد الأعمدة التي متوسط قيمها أكبر من 100 (أرقام تسلسلية أو مجاميع خاطئة)
    const avg = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
    if (avg > 100) return false;
    return true;
  }).map(h => {
    return { col: sanitizeKey(h), label: h, max: 100 };
  });

  // تحويل أسماء الأعمدة المحددة إلى مفاتيح Firebase-safe
  const seatColSafe    = sanitizeKey(seatCol);
  const nameColSafe    = nameCol    ? sanitizeKey(nameCol)    : '';
  const resultColSafe  = resultCol  ? sanitizeKey(resultCol)  : '';
  const totalColSafe   = totalCol   ? sanitizeKey(totalCol)   : '';
  const gradeValColSafe= gradeValCol? sanitizeKey(gradeValCol): '';

  // Build index by seat number — كل row يتحول لمفاتيح منظفة
  const index = {};
  parsedRows.forEach(row => {
    const seat = String(row[seatCol] || '').trim();
    if (!seat) return;
    const cleanRow = {};
    Object.entries(row).forEach(([k, v]) => {
      cleanRow[sanitizeKey(k)] = v;
    });
    index[seat] = cleanRow;
  });

  const key = sanitizeKey(`${grade}_${term}`);
  
  // 1. Create metadata (without index)
  const metadata = {
    grade, term,
    seatCol: seatColSafe,
    nameCol: nameColSafe,
    resultCol: resultColSafe,
    totalCol: totalColSafe,
    gradeValCol: gradeValColSafe,
    subjectCols, 
    count: parsedRows.length,
    uploadedAt: new Date().toLocaleDateString('ar-EG')
  };

  const btn = document.getElementById('uploadBtn');
  btn.textContent = '⏳ جاري الرفع...';
  btn.disabled = true;

  try {
    // Write metadata
    await set(ref(db, `metadata/${key}`), metadata);
    // Write student records
    await set(ref(db, `student_records/${key}`), index);
    // Write full dataset for backward compatibility
    const fullDataset = { ...metadata, index };
    await set(ref(db, `datasets/${key}`), fullDataset);

    showStatus(`✅ تم رفع نتيجة ${grade} - ${term} بنجاح! (${parsedRows.length} طالب)`, 'success');
    renderStoredList();
    // Reset
    parsedRows = []; parsedHeaders = [];
    document.getElementById('uploadForm').reset();
    ['columnMappingSection','previewSection'].forEach(id => document.getElementById(id).classList.add('hidden'));
    btn.classList.add('hidden');
    document.getElementById('dropContent').innerHTML = `
      <div class="drop-icon">📁</div>
      <h3>اسحب الملف هنا أو اضغط للاختيار</h3>
      <p>يدعم ملفات Excel (xlsx, xls) وCSV</p>
      <button type="button" class="choose-file-btn" id="chooseFileBtn">اختر الملف</button>`;
    document.getElementById('chooseFileBtn').addEventListener('click', () => fileInput.click());
  } catch(err) {
    showStatus('خطأ في الرفع: ' + err.message, 'error');
  } finally {
    btn.textContent = '💾 حفظ النتيجة';
    btn.disabled = false;
  }
});

// Clear all
document.getElementById('clearBtn').addEventListener('click', async () => {
  const confirmed = await showConfirm('هل أنت متأكد من حذف جميع البيانات؟ لا يمكن التراجع عن هذا!');
  if (!confirmed) return;
  try {
    await remove(ref(db, 'datasets'));
    await remove(ref(db, 'metadata'));
    await remove(ref(db, 'student_records'));
    showStatus('تم مسح جميع البيانات ✅', 'success');
    renderStoredList();
  } catch(e) {
    const msg = e.message || '';
    if (msg.toLowerCase().includes('permission')) {
      showStatus('❌ لا توجد صلاحية: افتح Firebase Console ← Realtime Database ← Rules ← اجعل .write: true', 'error');
    } else {
      showStatus('خطأ: ' + e.message, 'error');
    }
  }
});

renderStoredList();
