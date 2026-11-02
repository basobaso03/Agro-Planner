import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import cfg from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(cfg);
const storage = getStorage(app);
console.log('Storage initialized for bucket:', storage.app.options.storageBucket);

try {
  const testRef = ref(storage, 'test/hello.txt');
  await uploadString(testRef, 'Hello AgroPlanner Storage!');
  const url = await getDownloadURL(testRef);
  console.log('Upload success! URL:', url);
} catch (err) {
  console.error('Storage upload failed:', err.message, err.code);
}

