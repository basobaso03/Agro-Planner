import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const outDir = path.resolve('workflow-tests', 'fixtures', 'images');
fs.mkdirSync(outDir, { recursive: true });

const images = [
  {
    name: 'broiler-batch-cobb500.jpg',
    url: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=500&q=80',
    fallbackColor: '#E29578'
  },
  {
    name: 'boer-goat-herd.jpg',
    url: 'https://images.unsplash.com/photo-1524024973431-2ad916746881?w=500&q=80',
    fallbackColor: '#83C5BE'
  },
  {
    name: 'feed-delivery-invoice.jpg',
    url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&q=80',
    fallbackColor: '#FFDDD2'
  },
  {
    name: 'isuzu-npr-truck.jpg',
    url: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=500&q=80',
    fallbackColor: '#006D77'
  },
  {
    name: 'urgent-biosecurity-alert.jpg',
    url: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=500&q=80',
    fallbackColor: '#E63946'
  }
];

function download(url, filePath) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, filePath));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(filePath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(true);
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading test production images into', outDir);
  for (const item of images) {
    const dest = path.join(outDir, item.name);
    try {
      await download(item.url, dest);
      const stat = fs.statSync(dest);
      console.log(`✔ Downloaded ${item.name} (${stat.size} bytes)`);
    } catch (err) {
      console.warn(`! Network fetch error for ${item.name}, writing mock image data:`, err.message);
      // Write valid image header and payload
      const mockBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64'
      );
      fs.writeFileSync(dest, mockBuffer);
      console.log(`✔ Wrote valid fallback image for ${item.name}`);
    }
  }
}

main();

