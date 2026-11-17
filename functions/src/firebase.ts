import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ATA_DATABASE_ID } from './config';

const app = getApps().length > 0 ? getApps()[0] : initializeApp();

export const db = getFirestore(app, ATA_DATABASE_ID);
