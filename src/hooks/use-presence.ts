
'use client';
import { useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export function usePresence(userId?: string | null, userEmail?: string | null) {
  useEffect(() => {
    if (!userId || !userEmail) return;

    const presenceRef = doc(db, 'userPresence', userId);

    const updatePresence = () => {
        setDoc(presenceRef, { 
            email: userEmail,
            lastSeen: serverTimestamp() 
        }, { merge: true });
    };

    updatePresence(); 

  }, [userId, userEmail]);
}
