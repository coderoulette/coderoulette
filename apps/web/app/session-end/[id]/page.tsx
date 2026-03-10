"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export default function SessionEndPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "timer";

  const reasonMessages: Record<string, string> = {
    timer: "Time's up! Great session.",
    partner_left: "Your partner left the session.",
    rematch: "Session ended for re-matching.",
    checkin_declined: "Session ended at check-in.",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-md text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Session Complete</h1>
            <p className="text-gray-400">
              {reasonMessages[reason] || reasonMessages.timer}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push("/queue")}
              className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
            >
              Find another partner
            </button>

            <button
              onClick={() => router.push("/")}
              className="w-full px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors"
            >
              Back to home
            </button>
          </div>

          <p className="text-sm text-gray-600">
            Two humans + one Claude = magic.
          </p>
        </div>
      </main>
    </div>
  );
}
