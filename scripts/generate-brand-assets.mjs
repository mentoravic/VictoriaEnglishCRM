/**
 * Generează iconițele Mentora (favicon, PWA, apple-touch) din public/mentora-icon.png.
 *
 *   npm run brand:icons
 *
 * Sursa e insigna circulară Mentora (1024x1024, fundal alb).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = path.join(root, 'public')
const source = path.join(pub, 'mentora-icon.png')

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

// scale < 1 lasă margine albă în jurul insignei (zona sigură pentru icoanele maskable)
async function renderIcon(size, scale = 1) {
  const inner = Math.round(size * scale)
  const badge = await sharp(source).resize(inner, inner).png().toBuffer()
  if (inner === size) return badge
  return sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: badge, gravity: 'centre' }])
    .png()
    .toBuffer()
}

const targets = [
  { file: 'favicon-16.png', size: 16 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-48.png', size: 48 },
  { file: 'favicon.png', size: 64 },
  { file: 'apple-icon.png', size: 180, scale: 0.9 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-256.png', size: 256 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.78 },
]

for (const { file, size, scale } of targets) {
  fs.writeFileSync(path.join(pub, file), await renderIcon(size, scale))
  console.log(`  ✅ public/${file} (${size}x${size})`)
}

const ico = await pngToIco([await renderIcon(16), await renderIcon(32), await renderIcon(48)])
fs.writeFileSync(path.join(pub, 'favicon.ico'), ico)
console.log('  ✅ public/favicon.ico (16/32/48)')

// App Router preia app/favicon.ico și app/icon.png înaintea metadata.icons
fs.writeFileSync(path.join(root, 'app', 'favicon.ico'), ico)
fs.writeFileSync(path.join(root, 'app', 'icon.png'), await renderIcon(512))
console.log('  ✅ app/favicon.ico + app/icon.png')

console.log('\n🎨 Iconițe Mentora generate.')
