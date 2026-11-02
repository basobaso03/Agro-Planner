import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`✓ Signed in ${email} (UID: ${cred.user.uid})`);
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        console.log(`+ Created user ${email} (UID: ${cred.user.uid})`);
        return cred.user;
      } catch (createErr) {
        console.error(`X Failed to create ${email}:`, createErr.message);
      }
    } else {
      console.error(`X Failed to sign in ${email}:`, err.message);
    }
  }
}

async function main() {
  await testUser('admin.farms@agroplanner.com', 'AgroFarmAdmin2026!');
  await testUser('treasurer.audit@agroplanner.com', 'AgroTreasurer2026!');
  await testUser('operator.harare@agroplanner.com', 'AgroOperatorHarare2026!');
  await testUser('operator.bulawayo@agroplanner.com', 'AgroOperatorByo2026!');
  await testUser('investor.tariro@agroplanner.com', 'AgroInvestorTariro2026!');
  await testUser('investor.kudzi@agroplanner.com', 'AgroInvestorKudzi2026!');
  process.exit(0);
}

main();

