"use client";

import { UserProfile } from "@clerk/nextjs";

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Settings
        </h2>
        <p className="text-sm text-text-secondary">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none",
            },
          }}
        />
      </div>
    </div>
  );
}
