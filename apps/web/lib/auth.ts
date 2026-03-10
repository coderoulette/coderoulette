import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const p = profile as Record<string, unknown>;
        token.githubId = p.id;
        token.username = p.login;
        token.avatarUrl = p.avatar_url;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
        (session.user as Record<string, unknown>).username = token.username;
        (session.user as Record<string, unknown>).githubId = token.githubId;
        (session.user as Record<string, unknown>).avatarUrl = token.avatarUrl;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
