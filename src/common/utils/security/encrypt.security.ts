import crypto from "node:crypto";


// const ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
const ENCRYPTION_KEY = "12345678901234567890123456789012";
const IV_LENGTH = 16;

export function symmetricEncryption(text: string): string {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return iv.toString("hex") + ":" + encrypted;
}

export function symmetricDecryption(text : string): string {
    let [ivHex, encryptedText] = text.split(":");
    let iv = Buffer.from(ivHex!, "hex");
    let decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText!, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}   