import os from 'os';
import { spawn, execSync } from 'child_process';

// 1. Try to set up ADB port forwarding over USB (fastest, most reliable)
try {
  execSync('adb reverse tcp:3000 tcp:3000', { stdio: 'ignore' });
  console.log('\x1b[32m✔ USB detected: ADB reverse tcp:3000 -> tcp:3000 enabled (using localhost)\x1b[0m');
} catch (e) {
  // Not connected via adb or adb not in path
}

function getWifiIp() {
  const interfaces = os.networkInterfaces();
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (/wi-?fi|wireless|wlan/i.test(name) && addrs) {
      const match = addrs.find(a => (a.family === 'IPv4' || a.family === 4) && !a.internal);
      if (match) return match.address;
    }
  }

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!/vEthernet|Virtual|Loopback|WSL|docker/i.test(name) && addrs) {
      const match = addrs.find(a => (a.family === 'IPv4' || a.family === 4) && !a.internal);
      if (match) return match.address;
    }
  }

  return 'localhost';
}

const hostIp = getWifiIp();
console.log(`\x1b[32m✔ Wi-Fi IP:\x1b[0m ${hostIp}`);
console.log(`\x1b[33m! Note: Ensure 'npm run dev' is running in another terminal window!\x1b[0m\n`);

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['cap', 'run', 'android', '-l', '--host', hostIp, '--port', '3000', ...process.argv.slice(2)];

const child = spawn(cmd, args, { stdio: 'inherit', shell: true });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
