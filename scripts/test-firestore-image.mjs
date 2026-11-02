import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import cfg from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(cfg);
const db = cfg.firestoreDatabaseId 
  ? initializeFirestore(app, {}, cfg.firestoreDatabaseId)
  : initializeFirestore(app, {});

console.log('Testing Firestore with db:', cfg.firestoreDatabaseId || '(default)');

try {
  const dummyBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(50000); // ~50KB
  const testRef = doc(db, 'test', 'test-image-write');
  await setDoc(testRef, {
    title: 'Test Image Write',
    createdAt: new Date().toISOString(),
    photoUrl: dummyBase64
  });
  console.log('Successfully wrote 50KB image document to Firestore!');
  
  const snap = await getDoc(testRef);
  console.log('Read back doc size:', snap.data()?.photoUrl?.length);
  
  await deleteDoc(testRef);
  console.log('Successfully cleaned up test doc.');
} catch (err) {
  console.error('Firestore test failed:', err);
}

