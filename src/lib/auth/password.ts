import bcrypt from 'bcryptjs';

const COST = 12;

const passwordRules = {
  minLength: 12,
  maxLength: 128,
};

export type PasswordValidation = { valid: true } | { valid: false; message: string };

export function validatePassword(password: string): PasswordValidation {
  if (password.length < passwordRules.minLength) {
    return {
      valid: false,
      message: `Password must be at least ${passwordRules.minLength} characters.`,
    };
  }
  if (password.length > passwordRules.maxLength) {
    return {
      valid: false,
      message: `Password must be ${passwordRules.maxLength} characters or fewer.`,
    };
  }
  return { valid: true };
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
