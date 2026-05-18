import { storage } from './firebase';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';

// --- Constants ---
export const DEFAULT_ROOM_SEEDS = [
  { id: '1',  name: 'บ้าน 1',  type: 'บ้านเตียงเดี่ยว', price: 500 },
  { id: '2',  name: 'บ้าน 2',  type: 'บ้านเตียงเดี่ยว', price: 500 },
  { id: '3',  name: 'บ้าน 3',  type: 'บ้านใหญ่',         price: 700 },
  { id: '4',  name: 'ห้อง 4',  type: 'ห้องเตียงเดี่ยว', price: 400 },
  { id: '5',  name: 'ห้อง 5',  type: 'ห้องเตียงเดี่ยว', price: 400 },
  { id: '6',  name: 'ห้อง 6',  type: 'ห้องเตียงเดี่ยว', price: 400 },
  { id: '10', name: 'ห้อง 10', type: 'ห้องเตียงคู่',     price: 500 },
  { id: '11', name: 'ห้อง 11', type: 'ห้องเตียงคู่',     price: 500 },
  { id: 'B1', name: 'ห้อง B1', type: 'ห้องเตียงเดี่ยว', price: 350 },
  { id: 'B2', name: 'ห้อง B2', type: 'ห้องเตียงเดี่ยว', price: 350 },
  { id: 'B3', name: 'ห้อง B3', type: 'ห้องเตียงคู่',     price: 500 },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'ค่าแรงคนงาน', 'ค่าอินเตอร์เน็ต', 'ของใช้สิ้นเปลือง (สบู่/ทิชชู่)',
  'น้ำดื่ม', 'ค่าน้ำ/ค่าไฟ', 'ซ่อมบำรุง', 'อื่นๆ',
];

export const PAYMENT_METHODS = ['เงินสด', 'เงินโอน'];
export const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#64748b'];
export const TEMP_DURATIONS = [2, 3, 4, 6, 8];

// --- Date / Time helpers ---
export const getNowTimeStr = () => new Date().toTimeString().slice(0, 5);
export const formatDate = (date) => date.toISOString().split('T')[0];

// --- Thai / Buddhist Era date helpers ---
export const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export const THAI_DAYS_SHORT   = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

/**
 * formatThaiDate(dateStr, format)
 * Converts a Gregorian ISO date string (YYYY-MM-DD) to Buddhist Era display.
 * format: 'full'      → "17 พ.ค. 2568"
 *         'short'     → "17/05/2568"
 *         'yearOnly'  → "2568"
 *         'monthYear' → "พ.ค. 2568"
 *         'dayAbbr'   → "จ." (weekday abbreviation)
 *         'monthAbbr' → "พ.ค."
 *         'dayNum'    → "17"
 */
export const formatThaiDate = (dateStr, format = 'full') => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const buddhistYear = d.getFullYear() + 543;
  const month = d.getMonth();
  const day = d.getDate();
  const dow = d.getDay();
  switch (format) {
    case 'full':      return `${day} ${THAI_MONTHS_SHORT[month]} ${buddhistYear}`;
    case 'short':     return `${day}/${String(month + 1).padStart(2,'0')}/${buddhistYear}`;
    case 'yearOnly':  return String(buddhistYear);
    case 'monthYear': return `${THAI_MONTHS_SHORT[month]} ${buddhistYear}`;
    case 'dayAbbr':   return THAI_DAYS_SHORT[dow];
    case 'monthAbbr': return THAI_MONTHS_SHORT[month];
    case 'dayNum':    return String(day);
    default:          return `${day} ${THAI_MONTHS_SHORT[month]} ${buddhistYear}`;
  }
};

export const addDays = (dateStr, days) => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + parseInt(days));
  return formatDate(date);
};

export const calculateNights = (start, end) => {
  const diff = new Date(end) - new Date(start);
  const days = diff / (1000 * 60 * 60 * 24);
  return days > 0 ? days : 1;
};

export const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

// --- Doc number generator ---
export const generateSequentialDocNo = (prefix, dateStr, existingDocs) => {
  const yearMonth = dateStr.slice(0, 7).replace('-', '');
  const pattern = new RegExp(`^${prefix}-${yearMonth}-(\\d{3})$`);
  let maxNum = 0;
  existingDocs.forEach(d => {
    [d.docNo, d.checkInDocNo].forEach(code => {
      if (code) {
        const match = code.match(pattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
  });
  return `${prefix}-${yearMonth}-${String(maxNum + 1).padStart(3, '0')}`;
};

// --- Image helpers ---
const compressImageToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 1200;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

/** Upload bill photo to Firebase Storage. Returns download URL or null. */
export const uploadBillPhoto = async (file, docNo) => {
  if (!file) return null;
  try {
    const dataUrl = await compressImageToDataUrl(file);
    const path = `bills/${docNo || 'misc'}/${Date.now()}.jpg`;
    const fileRef = storageRef(storage, path);
    await uploadString(fileRef, dataUrl, 'data_url');
    return await getDownloadURL(fileRef);
  } catch (err) {
    console.error('uploadBillPhoto error:', err);
    return null;
  }
};

// --- CSV export ---
export const exportToCSV = (data, filename) => {
  if (!data?.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(f => `"${row[f] || ''}"`).join(',')),
  ].join('\n');
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Message templates ---
export const generateBookingSummary = (customerName, roomNames, checkInDate, nights, deposit, docNo) =>
  `ยืนยันการจองห้องพัก "จันผารีสอร์ท" 🌿\n\n👤 คุณ: ${customerName}\n🏠 ห้อง: ${roomNames}\n📅 เข้าพัก: ${formatThaiDate(checkInDate, 'full')} (${nights} คืน)\n💰 ยอดมัดจำ: ${Number(deposit).toLocaleString()} บาท\n🔖 เลขที่จอง: ${docNo}\n\n📌 เงื่อนไขการจอง:\nหากต้องการยกเลิกการจอง ต้องแจ้งล่วงหน้าอย่างน้อย 5 วัน เพื่อรับเงินคืนเต็มจำนวน (100%) หากแจ้งช้ากว่ากำหนด ขอสงวนสิทธิ์ในการคืนเงินมัดจำครับ`;
