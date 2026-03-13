import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";

const isDev = process.env.NODE_ENV === "development";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
          }),
        ]
      : []),
    ...(isDev
      ? [
          CredentialsProvider({
            name: "Dev Login",
            credentials: {
              username: { label: "Username", type: "text" },
            },
            async authorize(credentials) {
              const username = credentials?.username || "dev-user";
              return {
                id: `dev-${username}`,
                name: username,
                image: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${username}`,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "github" && profile) {
        const p = profile as Record<string, unknown>;
        token.githubId = p.id;
        token.username = p.login;
        token.avatarUrl = p.avatar_url;
      }
      if (account?.provider === "credentials" && user) {
        token.username = user.name;
        token.avatarUrl = user.image;
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
