"use client";

import { useEffect, useState } from "react";
import {
  focusFromImageData,
  PHOTO_CENTER,
  type PhotoFocus,
} from "@/lib/photo-focus";

const cache = new Map<string, PhotoFocus>();

type FaceBox = { x: number; y: number; width: number; height: number };
type FaceDetectorInstance = {
  detect: (source: CanvasImageSource) => Promise<{ boundingBox: FaceBox }[]>;
};

function detector() {
  const ctor = (
    window as unknown as {
      FaceDetector?: new (options: {
        fastMode: boolean;
        maxDetectedFaces: number;
      }) => FaceDetectorInstance;
    }
  ).FaceDetector;
  if (!ctor) return null;
  return new ctor({ fastMode: true, maxDetectedFaces: 4 });
}

async function faceFocus(image: HTMLImageElement): Promise<PhotoFocus | null> {
  const faces = detector();
  if (!faces || image.naturalWidth < 8) return null;
  let found: { boundingBox: FaceBox }[] = [];
  try {
    found = await faces.detect(image);
  } catch {
    return null;
  }
  const picture = image.naturalWidth * image.naturalHeight;
  let weightX = 0;
  let weightY = 0;
  let weight = 0;
  for (const face of found) {
    const box = face.boundingBox;
    const area = box.width * box.height;
    if (area < picture * 0.0015) continue;
    const mass = Math.sqrt(area);
    weightX += (box.x + box.width / 2) * mass;
    weightY += (box.y + box.height * 0.42) * mass;
    weight += mass;
  }
  if (weight <= 0) return null;
  return {
    x: Math.min(0.92, Math.max(0.08, weightX / weight / image.naturalWidth)),
    y: Math.min(0.86, Math.max(0.08, weightY / weight / image.naturalHeight)),
  };
}

function saliencyFocus(image: HTMLImageElement): PhotoFocus {
  const maxEdge = 64;
  const scale = maxEdge / Math.max(image.naturalWidth, image.naturalHeight);
  const width = Math.max(8, Math.round(image.naturalWidth * scale));
  const height = Math.max(8, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return PHOTO_CENTER;
  context.drawImage(image, 0, 0, width, height);
  try {
    const pixels = context.getImageData(0, 0, width, height);
    return focusFromImageData(pixels.data, width, height);
  } catch {
    return PHOTO_CENTER;
  }
}

export function usePhotoFocus(src: string) {
  const [focus, setFocus] = useState<PhotoFocus | null>(cache.get(src) ?? null);

  useEffect(() => {
    const known = cache.get(src);
    if (known) {
      setFocus(known);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      void (async () => {
        const face = await faceFocus(image);
        const texture = saliencyFocus(image);
        const next =
          face && Math.hypot(face.x - texture.x, face.y - texture.y) < 0.22
            ? face
            : texture;
        cache.set(src, next);
        if (!cancelled) setFocus(next);
      })();
    };
    image.onerror = () => {
      cache.set(src, PHOTO_CENTER);
      if (!cancelled) setFocus(PHOTO_CENTER);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return focus;
}
