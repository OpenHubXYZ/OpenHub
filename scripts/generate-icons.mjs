import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = path.join(rootDirectory, 'apps/desktop/public');

async function main() {
  await writePng(path.join(publicDirectory, 'icon.png'), createAppIcon(512));
  await writePng(path.join(publicDirectory, 'tray-icon.png'), createTrayIcon(18));
}

function createAppIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 64;
  const samples = 4;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let coverage = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (insideRoundedRect(px, py, 0, 0, size, size, 14 * scale)) {
            coverage += 1;
          }
        }
      }
      blendPixel(pixels, size, x, y, [0x16, 0x77, 0xf2, Math.round((coverage / (samples * samples)) * 255)]);
    }
  }

  drawCube(pixels, size, scale, [255, 255, 255, 255], 4.5 * scale);
  drawCircle(pixels, size, 32 * scale, 32 * scale, 7 * scale, [255, 255, 255, 255]);
  drawCircle(pixels, size, 32 * scale, 32 * scale, 5 * scale, [0x24, 0xa6, 0xb8, 255]);

  return { width: size, height: size, pixels };
}

function createTrayIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 64;

  drawCube(pixels, size, scale, [0, 0, 0, 255], Math.max(2.2, 6 * scale));
  drawCircle(pixels, size, 32 * scale, 32 * scale, 4.8 * scale, [0, 0, 0, 255]);

  return { width: size, height: size, pixels };
}

function drawCube(pixels, size, scale, color, strokeWidth) {
  const outer = [
    [32, 13.5],
    [48, 22.5],
    [48, 40.5],
    [32, 50],
    [16, 40.5],
    [16, 22.5],
    [32, 13.5]
  ].map(([x, y]) => [x * scale, y * scale]);
  const lines = [
    ...outer.slice(0, -1).map((point, index) => [point, outer[index + 1]]),
    [[17.5 * scale, 23.5 * scale], [32 * scale, 32 * scale]],
    [[32 * scale, 32 * scale], [46.5 * scale, 23.5 * scale]],
    [[32 * scale, 32 * scale], [32 * scale, 48 * scale]]
  ];

  drawStrokedLines(pixels, size, lines, strokeWidth, color);
}

function drawStrokedLines(pixels, size, lines, strokeWidth, color) {
  const half = strokeWidth / 2;
  const padding = Math.ceil(half + 1);

  for (const [[x1, y1], [x2, y2]] of lines) {
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - padding));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + padding));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - padding));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + padding));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = distanceToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2);
        const alpha = coverageFromDistance(distance, half);
        if (alpha > 0) {
          blendPixel(pixels, size, x, y, [color[0], color[1], color[2], Math.round(color[3] * alpha)]);
        }
      }
    }
  }
}

function drawCircle(pixels, size, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius + 1));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - distance));
      if (alpha > 0) {
        blendPixel(pixels, size, x, y, [color[0], color[1], color[2], Math.round(color[3] * alpha)]);
      }
    }
  }
}

function insideRoundedRect(x, y, rectX, rectY, width, height, radius) {
  const nearestX = Math.max(rectX + radius, Math.min(x, rectX + width - radius));
  const nearestY = Math.max(rectY + radius, Math.min(y, rectY + height - radius));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function coverageFromDistance(distance, halfStroke) {
  if (distance <= halfStroke - 0.5) {
    return 1;
  }
  if (distance >= halfStroke + 0.5) {
    return 0;
  }
  return halfStroke + 0.5 - distance;
}

function blendPixel(pixels, size, x, y, source) {
  if (source[3] <= 0) {
    return;
  }

  const offset = (y * size + x) * 4;
  const sourceAlpha = source[3] / 255;
  const targetAlpha = (pixels[offset + 3] ?? 0) / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outputAlpha === 0) {
    return;
  }

  for (let channel = 0; channel < 3; channel += 1) {
    const sourceChannel = source[channel] / 255;
    const targetChannel = (pixels[offset + channel] ?? 0) / 255;
    pixels[offset + channel] = Math.round(((sourceChannel * sourceAlpha + targetChannel * targetAlpha * (1 - sourceAlpha)) / outputAlpha) * 255);
  }
  pixels[offset + 3] = Math.round(outputAlpha * 255);
}

async function writePng(filePath, image) {
  const scanlines = Buffer.alloc((image.width * 4 + 1) * image.height);

  for (let y = 0; y < image.height; y += 1) {
    const rowOffset = y * (image.width * 4 + 1);
    scanlines[rowOffset] = 0;
    image.pixels.copy(scanlines, rowOffset + 1, y * image.width * 4, (y + 1) * image.width * 4);
  }

  const chunks = [
    pngChunk('IHDR', ihdr(image.width, image.height)),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ];
  await writeFile(filePath, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]));
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);

  lengthBuffer.writeUInt32BE(data.length, 0);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

await main();
