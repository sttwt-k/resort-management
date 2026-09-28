import { getAuth } from 'firebase/auth';

async function requestLineGroup(method, action) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบ Owner ก่อน');
  const response = await fetch('/api/line-group', {
    method,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`,
      ...(action ? { 'Content-Type': 'application/json' } : {}) },
    ...(action ? { body: JSON.stringify({ action }) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'เชื่อมต่อ LINE ไม่สำเร็จ');
  return result;
}

export const getLineGroup = () => requestLineGroup('GET');
export const startLinePairing = () => requestLineGroup('POST', 'start-pairing');
export const sendLineSummary = () => requestLineGroup('POST', 'send-summary');
