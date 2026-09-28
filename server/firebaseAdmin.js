/* global process */
import { cert, getApps, initializeApp } from 'firebase-admin/app';

export function getAdminApp() {
  if (getApps().length) return getApps()[0];
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    if (process.env.FIREBASE_PROJECT_ID !== 'demo-resort') throw new Error('Unexpected emulator project');
    return initializeApp({ projectId: 'demo-resort' });
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('Server credentials are not configured');
  const serviceAccount = JSON.parse(json);
  if (serviceAccount.project_id !== 'chanpha-resort') throw new Error('Unexpected Firebase project');
  return initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
}
