/** Saves data as a file: a download in the browser, a save dialog in the desktop app. */
export function downloadBlob(fileName: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the download start before the URL goes away.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Saves text as a file, like `downloadBlob`. */
export function downloadText(fileName: string, text: string, type = 'text/csv'): void {
  downloadBlob(fileName, new Blob([text], { type }));
}
