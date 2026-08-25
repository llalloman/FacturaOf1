import { Capacitor } from '@capacitor/core';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo preparar el archivo.'));
    reader.readAsDataURL(blob);
  });

const downloadBlobInBrowser = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const saveOrDownloadPdf = async (blob: Blob, fileName: string): Promise<'native' | 'browser'> => {
  if (!Capacitor.isNativePlatform()) {
    downloadBlobInBrowser(blob, fileName);
    return 'browser';
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  const path = `firmador/${fileName}`;
  const data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Documents,
    recursive: true,
  });

  await Share.share({
    title: fileName,
    text: 'PDF firmado desde OF1 Firmador',
    url: result.uri,
    dialogTitle: 'Guardar o compartir PDF firmado',
  });

  return 'native';
};
