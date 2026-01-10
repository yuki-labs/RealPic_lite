/**
 * Steganography Module
 * LSB (Least Significant Bit) encoding for invisible watermarks.
 */

const Steganography = (() => {
    const HEADER_SIZE = 32;
    const MAGIC_NUMBER = 0xCAFE;
    const MAGIC_BITS = 16;
    
    function stringToBinary(str) {
        let binary = '';
        for (let i = 0; i < str.length; i++) {
            binary += str.charCodeAt(i).toString(2).padStart(16, '0');
        }
        return binary;
    }
    
    function binaryToString(binary) {
        let str = '';
        for (let i = 0; i < binary.length; i += 16) {
            const charCode = parseInt(binary.substr(i, 16), 2);
            if (charCode > 0) str += String.fromCharCode(charCode);
        }
        return str;
    }
    
    function encode(imageData, message) {
        const data = new Uint8ClampedArray(imageData.data);
        const messageBinary = stringToBinary(message);
        const headerBits = MAGIC_BITS + HEADER_SIZE;
        const totalBitsNeeded = headerBits + messageBinary.length;
        
        if (Math.ceil(totalBitsNeeded / 3) > (data.length / 4)) {
            throw new Error('Message too long for image');
        }
        
        const fullBinary = MAGIC_NUMBER.toString(2).padStart(MAGIC_BITS, '0') +
                          messageBinary.length.toString(2).padStart(HEADER_SIZE, '0') +
                          messageBinary;
        
        let bitIndex = 0;
        for (let i = 0; i < data.length && bitIndex < fullBinary.length; i++) {
            if ((i + 1) % 4 === 0) continue;
            data[i] = (data[i] & 0xFE) | parseInt(fullBinary[bitIndex], 2);
            bitIndex++;
        }
        
        return new ImageData(data, imageData.width, imageData.height);
    }
    
    function decode(imageData) {
        const data = imageData.data;
        let bits = '', bitIndex = 0;
        const headerBits = MAGIC_BITS + HEADER_SIZE;
        
        for (let i = 0; i < data.length && bitIndex < headerBits; i++) {
            if ((i + 1) % 4 === 0) continue;
            bits += (data[i] & 1).toString();
            bitIndex++;
        }
        
        if (parseInt(bits.substring(0, MAGIC_BITS), 2) !== MAGIC_NUMBER) return null;
        
        const msgLen = parseInt(bits.substring(MAGIC_BITS), 2);
        if (msgLen <= 0 || msgLen > 100000) return null;
        
        let msgBits = '';
        for (let i = 0; i < data.length && msgBits.length < msgLen; i++) {
            if ((i + 1) % 4 === 0) continue;
            if (bitIndex++ <= headerBits - 1) continue;
            msgBits += (data[i] & 1).toString();
        }
        
        return binaryToString(msgBits);
    }
    
    function hasHiddenData(imageData) {
        const data = imageData.data;
        let bits = '', count = 0;
        for (let i = 0; i < data.length && count < MAGIC_BITS; i++) {
            if ((i + 1) % 4 === 0) continue;
            bits += (data[i] & 1).toString();
            count++;
        }
        return parseInt(bits, 2) === MAGIC_NUMBER;
    }
    
    return { encode, decode, hasHiddenData };
})();
