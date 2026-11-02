import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import cfg from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(cfg);
const storage = getStorage(app);
console.log('Testing storage with error inspection...');
try {
  const testRef = ref(storage, 'test/hello.txt');
  await uploadString(testRef, 'Hello Storage');
} catch (err) {
  console.log('Error properties:', Object.keys(err));
  console.log('Server response:', err.serverResponse);
  console.log('Status code:', err.status_);
  console.log('Custom data:', err.customData);
}

