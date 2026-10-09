export async function captureChart(svg) {
  if (!svg) throw new Error('No chart to capture');

  const text = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));

  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Chart capture failed'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');

    canvas.width = svg.viewBox.baseVal.width || 1000;
    canvas.height = 440;
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('Chart capture failed')),
        'image/png'
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
