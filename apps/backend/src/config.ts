import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || process.env.SERVER_PORT || process.env.BACKEND_PORT || '3000', 10),
  host: process.env.BACKEND_HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'sep_ai_remote_super_secret_jwt_key_2026',
  pairingCode: process.env.PAIRING_CODE || '888999',
  databaseFile: process.env.DATABASE_FILE || './data/sep_ai.db',
  fcmServerKey: process.env.FCM_SERVER_KEY || '',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
