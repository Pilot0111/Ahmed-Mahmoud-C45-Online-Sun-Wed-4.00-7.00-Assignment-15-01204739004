/**
 * Generates a random 6-digit numeric code.
 * @returns {string} A 6-digit OTP as a string.
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};