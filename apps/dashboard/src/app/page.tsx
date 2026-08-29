'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { DealLifecycleNav } from '../components/DealLifecycleNav';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'merchant') {
      router.replace('/merchant-console');
    } else {
      router.replace('/deal-room');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex flex-col justify-between">
      <DealLifecycleNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-signal border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-mono text-ink-400">
            Routing to {user?.role === 'merchant' ? 'Merchant Console' : 'Live Deal Room'}...
          </p>
        </div>
      </main>
    </div>
  );
}
