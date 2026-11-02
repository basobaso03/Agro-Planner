import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import cfg from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(cfg);
const db = cfg.firestoreDatabaseId 
  ? initializeFirestore(app, {}, cfg.firestoreDatabaseId)
  : initializeFirestore(app, {});

console.log('Testing Firestore with livestock_entries...');

try {
  const dummyBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(50000); // ~50KB
  const testId = 'LSTK-TEST-SCRIPT-01';
  const testRef = doc(db, 'livestock_entries', testId);
  await setDoc(testRef, {
    id: testId,
    locationId: 'LOC-HARARE-NORTH',
    locationName: 'Harare North Poultry & Goat Station',
    species: 'Broilers',
    nameOrTag: 'Test Batch Script',
    trackingMode: 'BATCH',
    entryDate: new Date().toISOString(),
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 42,
    targetDurationUnit: 'DAYS',
    targetSaleDate: new Date(Date.now() + 42*86400000).toISOString(),
    initialHeadcount: 100,
    purchaseCostTotal: 95,
    notes: 'Testing script entry',
    createdByMemberName: 'Automated Script',
    createdAt: new Date().toISOString(),
    imageUrl: dummyBase64
  });
  console.log('Successfully wrote livestock entry with 50KB image to Firestore!');
  
  const snap = await getDoc(testRef);
  console.log('Read back doc exists:', snap.exists(), 'imageUrl length:', snap.data()?.imageUrl?.length);
  
} catch (err) {
  console.error('Firestore write failed:', err);
}

