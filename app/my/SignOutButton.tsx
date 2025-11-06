// app/my/SignOutButton.tsx
'use client';

import { signOut } from 'next-auth/react';

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
      aria-label="Sign out"
    >
      <span>Sign out</span>
    </button>
  );
}
