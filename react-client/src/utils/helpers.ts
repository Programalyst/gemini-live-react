export const pcm16ToBase64 = (pcm16Data: Int16Array): string => {
    const buffer = pcm16Data.buffer; // Get the underlying ArrayBuffer
    const uint8ArrayInstance = new Uint8Array(buffer);

    let binaryString = '';
    const chunkSize = 8192; // Mitigate String.fromCharCode call stack limits
    for (let i = 0; i < uint8ArrayInstance.length; i += chunkSize) {
        const chunk = uint8ArrayInstance.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
    }
    try {
        return btoa(binaryString);
    } catch (e) {
        console.error("Error in btoa during pcm16ToBase64:", e);
        return "";
    }
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

// serverX is the screen position in pixels from the left that the server wants to click
export const screenToVideoCanvasX = (serverX: number, screenX: number | undefined): number => {
    // top left is 0, 0
    // video frame width is 800 x 450. 16:9 aspect ratio
    //console.log(`serverX: ${serverX}, dot x:${serverX * 400 + 400}`)
    //return serverX * 400 + 400
    return screenX ? serverX / screenX * 800 : 0
}

// serverY is the screen position in pixels from the top that the server wants to click
export const screenToVideoCanvasY = (serverY: number, screenY: number | undefined): number => {
    // top left is 0, 0
    // video frame width is 800 x 450. 16:9 aspect ratio
    //return -serverY * 225 + 225
    return screenY ? serverY / screenY * 450 : 0
}