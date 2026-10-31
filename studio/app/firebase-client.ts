'use client';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

export function getFirebaseClient() {
  const app = getApps().find(app=>app.name==='paradoxsoftware-company') ?? initializeApp(firebaseConfig, 'paradoxsoftware-company');
  return { app, auth:getAuth(app), db:getFirestore(app) };
}
