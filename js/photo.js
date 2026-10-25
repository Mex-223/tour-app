// Shrinks a photo from the camera or gallery to a small JPEG (usually 40–120 KB),
// so it fits in the free database and loads fast without signal.
export async function shrinkPhoto(file, maxSide = 640, maxChars = 160000) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file could not be opened as a picture.'));
      i.src = url;
    });
    let side = maxSide;
    for (let round = 0; round < 6; round += 1) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      for (const q of [0.78, 0.68, 0.58]) {
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length <= maxChars) return data;
      }
      side = Math.round(side * 0.8);
    }
    throw new Error('That photo is too big, please try another one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const kb = (dataUrl) => Math.round((String(dataUrl).length * 3) / 4 / 1024);
