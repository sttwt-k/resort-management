import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { initializeApp as initializeAdmin } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  initializeAuth, inMemoryPersistence, connectAuthEmulator,
  signInWithEmailAndPassword, signInAnonymously, signOut,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, getDocsFromServer } from 'firebase/firestore';

const projectId = 'demo-resort';
const ownerUid = 'UuSyhl057OdUcvznOgsrq1lHhct2';
const ownerEmail = 'owner@janchpa.internal';
const password = String(randomInt(100000, 1000000));
const admin = initializeAdmin({ projectId });
await getAdminAuth(admin).createUser({ uid: ownerUid, email: ownerEmail, password });
const expensesPath = ['artifacts', 'my-resort-app-v1', 'public', 'data', 'expenses'];
await getAdminFirestore(admin).doc([...expensesPath, 'demo-expense'].join('/')).set({ title: 'Demo expense', amount: 1 });

function client(name) {
  const app = initializeApp({ apiKey: 'fake-key', projectId }, name);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { app, auth, db };
}

const first = client('owner-tab');
try {
  await signInWithEmailAndPassword(first.auth, ownerEmail, password);
  assert.equal((await getDocsFromServer(collection(first.db, ...expensesPath))).size, 1);

  const newTab = client('fresh-tab');
  try {
    assert.equal(newTab.auth.currentUser, null, 'fresh tab has no owner session');
    await signInAnonymously(newTab.auth);
    await assert.rejects(getDocsFromServer(collection(newTab.db, ...expensesPath)),
      error => error.code === 'permission-denied', 'staff cannot read owner expenses');
  } finally {
    await deleteApp(newTab.app);
  }

  await signOut(first.auth);
  await signInAnonymously(first.auth);
  await assert.rejects(getDocsFromServer(collection(first.db, ...expensesPath)),
    error => error.code === 'permission-denied', 'owner-to-staff downgrade loses expense access');
  process.stdout.write('PASS fresh-tab owner isolation and owner-to-staff expense denial\n');
} finally {
  await deleteApp(first.app);
}
