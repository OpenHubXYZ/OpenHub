import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

const publicDirectory = path.resolve(__dirname, '../../public');

describe('desktop icon assets', () => {
  it('keeps Dock icon corners transparent', async () => {
    const icon = parseRgbaPng(await readFile(path.join(publicDirectory, 'icon.png')));

    expect(icon.width).toBe(512);
    expect(icon.height).toBe(512);
    expect(icon.pixel(0, 0)[3]).toBe(0);
    expect(icon.pixel(icon.width - 1, 0)[3]).toBe(0);
    expect(icon.pixel(0, icon.height - 1)[3]).toBe(0);
    expect(icon.pixel(icon.width - 1, icon.height - 1)[3]).toBe(0);
  });

  it('uses a small transparent template image for the menu-bar tray', async () => {
    const icon = parseRgbaPng(await readFile(path.join(publicDirectory, 'tray-icon.png')));

    expect(icon.width).toBeLessThanOrEqual(22);
    expect(icon.height).toBeLessThanOrEqual(22);
    expect(icon.pixel(0, 0)[3]).toBe(0);
    expect(icon.pixel(Math.floor(icon.width / 2), Math.floor(icon.height / 2))[3]).toBeGreaterThan(0);
  });
});

function parseRgbaPng(buffer: Buffer): {
  width: number;
  height: number;
  pixel: (x: number, y: number) => [number, number, number, number];
} {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
  }

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`Expected non-interlaced 8-bit RGBA PNG, got bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(height * stride);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++];
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] ?? 0 : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] ?? 0 : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * stride + x - bytesPerPixel] ?? 0 : 0;
      const value = raw[rawOffset++] ?? 0;
      pixels[y * stride + x] = unfilter(value, filter ?? 0, left, up, upLeft);
    }
  }

  return {
    width,
    height,
    pixel(x: number, y: number): [number, number, number, number] {
      const pixelOffset = (y * width + x) * bytesPerPixel;
      return [
        pixels[pixelOffset] ?? 0,
        pixels[pixelOffset + 1] ?? 0,
        pixels[pixelOffset + 2] ?? 0,
        pixels[pixelOffset + 3] ?? 0
      ];
    }
  };
}

function unfilter(value: number, filter: number, left: number, up: number, upLeft: number): number {
  if (filter === 0) {
    return value;
  }
  if (filter === 1) {
    return (value + left) & 255;
  }
  if (filter === 2) {
    return (value + up) & 255;
  }
  if (filter === 3) {
    return (value + Math.floor((left + up) / 2)) & 255;
  }
  if (filter === 4) {
    return (value + paeth(left, up, upLeft)) & 255;
  }

  throw new Error(`Unsupported PNG filter ${filter}`);
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}
