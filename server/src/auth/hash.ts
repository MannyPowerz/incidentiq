// hashPassword(plain): Promise<string>
//                     verifyPassword(plain, stored): Promise<boolean>

import bcrypt from 'bcrypt';
import { SALT_ROUNDS } from '../constants/auth.js';

export async function hashPassword(plain: string): Promise<string> {
  const result = await bcrypt.hash(plain, SALT_ROUNDS);
  return result;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const match = await bcrypt.compare(plain, stored);
  return match;
}
