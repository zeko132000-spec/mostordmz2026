// app.js - Student search with Firebase Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

document.getElementById('year').textContent = new Date().getFullYear();

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

let allDatasets = {};

// Load all datasets metadata and populate grade list
async function init() {
  try {
    // Try to load metadata first (much faster)
    let snapshot = await get(ref(db, 'metadata'));
    let data = null;
    if (snapshot.exists()) {
      data = snapshot.val();
    } else {
      // Fallback to old 'datasets' node
      snapshot = await get(ref(db, 'datasets'));
      if (snapshot.exists()) {
        data = snapshot.val();
      }
    }
    
    if (!data) {
      document.getElementById('noDataNotice').classList.remove('hidden');
      return;
    }
    
    allDatasets = data;
    const grades = [...new Set(Object.values(allDatasets).map(d => d.grade))];
    const sel = document.getElementById('gradeSelect');
    // Clear existing options
    sel.innerHTML = '<option value="">-- اختر الصف --</option>';
    grades.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      sel.appendChild(opt);
    });
  } catch(e) {
    document.getElementById('noDataNotice').classList.remove('hidden');
    console.error(e);
  }
}

function scoreClass(score, max) {
  if (!max) return '';
  const pct = (score / max) * 100;
  return pct >= 70 ? 'high' : pct >= 50 ? 'mid' : 'low';
}

// ============================================================
// 🏫 نهاية كل مادة حسب الصف (ابتدائي = 100 / إعدادي = حسب الجدول)
// ============================================================
function getSubjectMax(label, grade) {
  // كشف الصف الإعدادي بكل تهجئاته
  const isPrep = /اعداد|إعداد|اعدادى|إعدادى|preparatory/i.test(grade || '');
  if (!isPrep) return 100; // ابتدائي: كل المواد من 100

  // حذف حرف التطويل (ـ) والتشكيل حتى يعمل الـ regex مع أي تهجئة
  const n = label.trim().replace(/[\u0640\u064B-\u065F]/g, '');
  // عربي من 80 — يشمل: عربي، اللغة العربية، لغة عربية
  if (/عرب/i.test(n)) return 80;
  // رياضيات أو لغة أجنبية من 60 — يشمل كل التهجئات
  if (/رياض|ماث|انجليز|إنجليز|اجنب|أجنب|لغه.{0,5}اجنب|لغة.{0,5}اجنب|لغه.{0,5}أجنب|لغة.{0,5}أجنب|فرنس|english|math|foreign/i.test(n)) return 60;
  // علوم أو دراسات من 40 — يشمل: العلوم، العلـوم، علوم طبيعية، الدراسات الاجتماعية
  if (/علو|science|دراس|اجتماع/i.test(n)) return 40;
  // دين و حاسب و نشاط و رسم و فنون من 20
  if (/دين|حاسب|نشاط|رسم|فنون|تربية|موسيق|بدني/i.test(n)) return 20;
  // باقي المواد الإعدادية = 20 افتراضياً
  return 20;
}

function getTotalMax(grade) {
  if (/اعداد|إعداد/i.test(grade || '')) return 280;
  return null; // للابتدائي: ما نعرضش نهاية محددة للمجموع
}

function renderResult(student, dataset) {
  const { seatCol, nameCol, gradeValCol, resultCol, totalCol, subjectCols, grade, term } = dataset;
  const name = nameCol ? (student[nameCol] || 'غير محدد') : 'غير محدد';
  const gradeVal = gradeValCol ? student[gradeValCol] || '' : '';
  const resultVal = resultCol ? student[resultCol] || '' : '';
  const total = totalCol ? student[totalCol] ?? '' : '';

  const isPass  = /ناجح|نجح|pass/i.test(resultVal);
  const isFail  = /راسب|رسب|fail/i.test(resultVal);
  const isSecond = /دور ثان|دور_ثان|second/i.test(resultVal);
  // تحديد اللون بدقة: ناجح=أخضر، دور ثاني=برتقالي، راسب=أحمر، غير محدد=رمادي
  const badgeClass = isPass ? 'pass' : isFail ? 'fail' : isSecond ? 'second' : 'unknown';
  const emoji = isPass ? '🎉' : isFail ? '😔' : isSecond ? '⚠️' : '📋';

  let subjectsHTML = '';
  const isPrep = /اعداد|إعداد|اعدادى|إعدادى|preparatory/i.test(grade || '');

  if (subjectCols && subjectCols.length > 0) {
    if (isPrep) {
      // فصل المواد الأساسية (في المجموع) عن المواد الخارجية (خارج المجموع)
      const mainSubs  = subjectCols.filter(sc => getSubjectMax(sc.label, grade) > 20);
      const extraSubs = subjectCols.filter(sc => getSubjectMax(sc.label, grade) <= 20);

      const renderCards = (cols) => cols.map(sc => {
        const val = student[sc.col];
        const num = parseFloat(val);
        const MAX = getSubjectMax(sc.label, grade);
        const cls = !isNaN(num) ? scoreClass(num, MAX) : '';
        return `<div class="subject-card">
          <div class="subject-name">${sc.label}</div>
          <div class="subject-score ${cls}">${val || '-'}</div>
          <div class="subject-max">من ${MAX}</div>
        </div>`;
      }).join('');

      if (mainSubs.length > 0) {
        subjectsHTML += `<div class="subjects-group-label">📚 المواد الأساسية (في المجموع)</div>
          <div class="subjects-grid">${renderCards(mainSubs)}</div>`;
      }
      if (extraSubs.length > 0) {
        subjectsHTML += `<div class="subjects-group-label extra-label">➕ مواد خارج المجموع</div>
          <div class="subjects-grid">${renderCards(extraSubs)}</div>`;
      }
    } else {
      // ابتدائي: كل المواد معاً
      subjectsHTML = `<div class="subjects-grid">` + subjectCols.map(sc => {
        const val = student[sc.col];
        const num = parseFloat(val);
        const MAX = getSubjectMax(sc.label, grade);
        const cls = !isNaN(num) ? scoreClass(num, MAX) : '';
        return `<div class="subject-card">
          <div class="subject-name">${sc.label}</div>
          <div class="subject-score ${cls}">${val || '-'}</div>
          <div class="subject-max">من ${MAX}</div>
        </div>`;
      }).join('') + `</div>`;
    }
  }

  const infoHTML = `<div class="result-info-grid">
    <div class="info-item"><div class="info-label">رقم الجلوس</div><div class="info-value">${student[seatCol]}</div></div>
    <div class="info-item"><div class="info-label">الصف</div><div class="info-value">${grade}</div></div>
    <div class="info-item"><div class="info-label">الفصل</div><div class="info-value">${term}</div></div>
    ${gradeVal ? `<div class="info-item"><div class="info-label">التقدير</div><div class="info-value">${gradeVal}</div></div>` : ''}
  </div>`;

  const totalMax = getTotalMax(grade);
  const totalHTML = total !== '' ? `<div class="total-bar">
    <span class="total-label">🏆 المجموع الكلي</span>
    <span class="total-score">${total}${totalMax ? ` <span class="total-max-label">من ${totalMax}</span>` : ''}</span>
  </div>` : '';


  // عرض النص الفعلي من الإكسيل في الشارة
  const badgeText = resultVal || (isPass ? 'ناجح' : isFail ? 'راسب' : 'غير محدد');

  return `<div class="result-card">
    <div class="result-header ${badgeClass}">
      <div class="result-emoji">${emoji}</div>
      <div>
        <div class="result-name">${name}</div>
        <div class="result-meta">رقم الجلوس: ${student[seatCol]} | ${grade} | ${term}</div>
      </div>
      <div class="result-badge ${badgeClass}">${badgeText}</div>
    </div>
    <div class="result-body">
      ${infoHTML}${subjectsHTML}${totalHTML}
    </div>
    <div class="result-actions no-print">
      <button class="print-btn" onclick="printResult()">🖨️ طباعة / حفظ PDF</button>
    </div>
  </div>`;
}

function renderNotFound(seat, grade) {
  return `<div class="result-card not-found-card glass-card">
    <div class="not-found-icon">🔍</div>
    <h3>لم يتم العثور على النتيجة</h3>
    <p>لا توجد نتيجة برقم الجلوس <strong>${seat}</strong>${grade ? ` في صف <strong>${grade}</strong>` : ''}.</p>
  </div>`;
}

document.getElementById('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const seat = document.getElementById('seatNumber').value.trim();
  const grade = document.getElementById('gradeSelect').value;
  const term = document.getElementById('termSelect').value;
  if (!seat) { alert('يرجى إدخال رقم الجلوس'); return; }

  const btn = document.getElementById('searchBtn');
  btn.innerHTML = '<span>⏳</span><span>جاري البحث...</span>';
  btn.disabled = true;

  try {
    let found = null;
    const datasetKeys = Object.keys(allDatasets);
    
    if (datasetKeys.length > 0) {
      // Check if dataset is in the old format (contains 'index' inline)
      const firstDataset = Object.values(allDatasets)[0];
      const isOldFormat = firstDataset.index !== undefined;
      
      if (isOldFormat) {
        // Old format: local client-side search
        for (const [key, dataset] of Object.entries(allDatasets)) {
          if (grade && dataset.grade !== grade) continue;
          if (term && dataset.term !== term) continue;
          const student = dataset.index?.[seat];
          if (student) { found = { student, dataset }; break; }
        }
      } else {
        // New format: fetch specific student record dynamically (super lightweight)
        for (const [key, dataset] of Object.entries(allDatasets)) {
          if (grade && dataset.grade !== grade) continue;
          if (term && dataset.term !== term) continue;
          
          const studentSnapshot = await get(ref(db, `student_records/${key}/${seat}`));
          if (studentSnapshot.exists()) {
            found = { student: studentSnapshot.val(), dataset };
            break;
          }
        }
      }
    }

    const sec = document.getElementById('resultSection');
    const content = document.getElementById('resultContent');
    sec.classList.remove('hidden');
    content.innerHTML = found
      ? renderResult(found.student, found.dataset)
      : renderNotFound(seat, grade);
    sec.scrollIntoView({ behavior: 'smooth' });
  } catch(err) {
    alert('خطأ في البحث: ' + err.message);
  } finally {
    btn.innerHTML = '<span class="btn-icon">🔍</span><span>بحث عن النتيجة</span>';
    btn.disabled = false;
  }
});

init();

// Print result
window.printResult = function() {
  window.print();
};
