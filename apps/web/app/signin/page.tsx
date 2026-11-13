import { signIn } from "@/auth";
import { Lock } from "lucide-react";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl = "/", error } = await searchParams;
  const google = !!process.env.AUTH_GOOGLE_ID, entra = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  return (
    <div className="mx-auto mt-[12vh] max-w-[420px] rounded-card border border-line bg-surface p-6">
      <Lock size={18} className="text-muted" aria-hidden />
      <h1 className="mt-3 font-display text-[26px]">Buoyant sign-in</h1>
      <p className="mt-1 text-sm text-muted">The terminal is for Buoyant staff. Use your work account.</p>
      {error && <p className="mt-3 text-sm text-neg">That account is not on the Buoyant domain. Sign in with your work address.</p>}
      <div className="mt-5 space-y-2">
        {google && <form action={async () => { "use server"; await signIn("google", { redirectTo: callbackUrl }); }}><button className="h-10 w-full rounded-card bg-ink text-sm font-medium text-paper">Continue with Google Workspace</button></form>}
        {entra && <form action={async () => { "use server"; await signIn("microsoft-entra-id", { redirectTo: callbackUrl }); }}><button className="h-10 w-full rounded-card bg-ink text-sm font-medium text-paper">Continue with Microsoft</button></form>}
        {!google && !entra && <p className="text-sm text-warn">No SSO provider is configured. Set AUTH_GOOGLE_ID or AUTH_MICROSOFT_ENTRA_ID_ID in Vercel.</p>}
      </div>
    </div>
  );
}
