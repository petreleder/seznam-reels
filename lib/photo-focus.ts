export type PhotoFocus = { x: number; y: number };

export const PHOTO_CENTER: PhotoFocus = { x: 0.5, y: 0.42 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Main motif of a photo, as a point in the image (0–1).
 * Prefers a patch with detail in both directions (a person, a group, furniture)
 * over a straight edge such as a platform line, a wall, or the sky.
 */
export function focusFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): PhotoFocus {
  if (width < 8 || height < 8) return PHOTO_CENTER;
  const count = width * height;
  const lum = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    lum[index] =
      0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
  }

  const radius = 2;
  const score = new Float32Array(count);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumX = 0;
      let sumX2 = 0;
      let sumY = 0;
      let sumY2 = 0;
      const samples = radius * 2 + 1;
      for (let step = -radius; step <= radius; step++) {
        const sampleX = lum[y * width + Math.min(width - 1, Math.max(0, x + step))];
        sumX += sampleX;
        sumX2 += sampleX * sampleX;
        const sampleY = lum[Math.min(height - 1, Math.max(0, y + step)) * width + x];
        sumY += sampleY;
        sumY2 += sampleY * sampleY;
      }
      const varianceX = sumX2 / samples - (sumX / samples) ** 2;
      const varianceY = sumY2 / samples - (sumY / samples) ** 2;
      score[y * width + x] = Math.sqrt(Math.min(varianceX, varianceY));
    }
  }

  const windowW = Math.max(4, Math.round(width * 0.38));
  const windowH = Math.max(4, Math.round(height * 0.42));
  let best = 0;
  let bestX = Math.round((width - windowW) / 2);
  let bestY = Math.round((height - windowH) / 2);
  for (let y = 0; y <= height - windowH; y += 2) {
    for (let x = 0; x <= width - windowW; x += 2) {
      let sum = 0;
      for (let row = y; row < y + windowH; row += 2) {
        for (let col = x; col < x + windowW; col += 2) {
          sum += score[row * width + col];
        }
      }
      const nx = (x + windowW / 2) / width - 0.5;
      const ny = (y + windowH / 2) / height - 0.42;
      const prior = 0.82 + 0.18 * Math.exp(-(nx * nx + ny * ny) / 0.2);
      const ranked = sum * prior;
      if (ranked > best) {
        best = ranked;
        bestX = x;
        bestY = y;
      }
    }
  }

  let windowPeak = 0;
  for (let y = bestY; y < bestY + windowH; y++) {
    for (let x = bestX; x < bestX + windowW; x++) {
      if (score[y * width + x] > windowPeak) windowPeak = score[y * width + x];
    }
  }
  let weightX = 0;
  let weightY = 0;
  let weight = 0;
  const cutoff = windowPeak * 0.45;
  for (let y = bestY; y < bestY + windowH; y++) {
    for (let x = bestX; x < bestX + windowW; x++) {
      const value = score[y * width + x];
      if (value < cutoff) continue;
      weightX += (x + 0.5) * value;
      weightY += (y + 0.5) * value;
      weight += value;
    }
  }
  if (weight <= 0) {
    return {
      x: clamp((bestX + windowW / 2) / width, 0.08, 0.92),
      y: clamp((bestY + windowH / 2) / height, 0.08, 0.86),
    };
  }
  return {
    x: clamp(weightX / weight / width, 0.08, 0.92),
    y: clamp(weightY / weight / height, 0.08, 0.86),
  };
}

/** object-position (0–1) that places an image point at the center of the frame. */
export function positionForFocus(
  subject: number,
  displayed: number,
  frame: number,
) {
  if (displayed - frame < 2) return 0.5;
  const position = (0.5 * frame - subject * displayed) / (frame - displayed);
  return clamp(position, 0, 1);
}
