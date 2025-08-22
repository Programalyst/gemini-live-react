export const pcm16ToBase64 = (pcm16Data: Int16Array): string => {
    const uint8View = new Uint8Array(
        pcm16Data.buffer, 
        pcm16Data.byteOffset, 
        pcm16Data.byteLength
    );

    let binaryString = '';
    const chunkSize = 8192; // Mitigate String.fromCharCode call stack limits
    for (let i = 0; i < uint8View.length; i += chunkSize) {
        const chunk = uint8View.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
    }

    try {
        return btoa(binaryString);
    } catch (e) {
        console.error("Error in btoa during pcm16ToBase64:", e);
        return "";
    }
}

// Skip creation of binary string and directly create a Blob for better performance
export const pcm16ToBase64Async = (pcm16Data: Int16Array): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uint8View = new Uint8Array(
        pcm16Data.buffer as ArrayBuffer,
        pcm16Data.byteOffset,
        pcm16Data.byteLength
    );
    
    const blob = new Blob([uint8View], { type: 'application/octet-stream' });
    
    const reader = new FileReader();
    
    reader.onload = () => {
      // The result is a data URL, e.g., "data:application/octet-stream;base64,SGVsbG8..."
      // We need to extract just the base64 part
      const dataUrl = reader.result as string;
      const base64String = dataUrl.split(',')[1];
      resolve(base64String);
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to convert data to base64"));
    };
    
    reader.readAsDataURL(blob);
  });
}

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64); // Decode base64 to binary string
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};