import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/* Buoyant SSO only. Which provider is live depends on the env vars set in
   Vercel (Google Workspace or Microsoft Entra: open question for IT).
   Sign-in is refused for any address outside AUTH_ALLOWED_DOMAIN. */
const providers = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google({ authorization: { params: { hd: process.env.AUTH_ALLOWED_DOMAIN } } }));
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) providers.push(MicrosoftEntraID({ issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER }));

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: "/signin" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  callbacks: {
    signIn({ profile, user }) {
      const email = (profile?.email || user?.email || "").toLowerCase();
      const domain = (process.env.AUTH_ALLOWED_DOMAIN || "").toLowerCase();
      return !!domain && email.endsWith("@" + domain);
    },
    authorized({ auth }) { return !!auth?.user; },
  },
});
