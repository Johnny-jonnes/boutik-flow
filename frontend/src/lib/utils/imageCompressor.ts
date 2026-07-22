/**
 * Utility to compress and resize images client-side before upload/storage.
 * Converts any heavy image (3MB-8MB) into a lightweight JPEG (~50KB-100KB).
 */

export async function compressImage(
  dataUrlOrFile: string | File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(typeof dataUrlOrFile === 'string' ? dataUrlOrFile : '');
      return;
    }

    const img = new Image();

    const processImage = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions respecting aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Export as JPEG compressed
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } else {
        resolve(typeof dataUrlOrFile === 'string' ? dataUrlOrFile : '');
      }
    };

    if (typeof dataUrlOrFile === 'string') {
      img.onload = processImage;
      img.onerror = () => resolve(dataUrlOrFile);
      img.src = dataUrlOrFile;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = processImage;
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(dataUrlOrFile);
    }
  });
}
