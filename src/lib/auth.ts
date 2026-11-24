import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function invalidToken(token: JWT): JWT {
  // id dipertahankan supaya request berikutnya bisa dicek ulang (mis. setelah DB pulih / user diaktifkan lagi).
  const { role: _role, storeIds: _storeIds, ...rest } = token as JWT & { role?: unknown; storeIds?: unknown };
  return { ...rest, invalid: true };
}

/**
 * T-013 nomor 10: setiap request (getServerSession / /api/auth/session) role, isActive, dan
 * storeIds dibaca ulang dari DB untuk token.id -- perubahan akses berlaku tanpa login ulang,
 * user nonaktif/terhapus langsung ditolak. 1 panggilan Prisma ringan (id, role, isActive,
 * storeAccess.storeId). User tidak ada, nonaktif, atau DB gagal -> token.invalid (fail-closed).
 */
export async function refreshTokenAccess(token: JWT): Promise<JWT> {
  if (typeof token.id !== "string" || !token.id) return invalidToken(token);
  let user: { role: string; isActive: boolean; storeAccess: { storeId: string }[] } | null;
  try {
    user = await prisma.user.findUnique({
      where: { id: token.id },
      select: { id: true, role: true, isActive: true, storeAccess: { select: { storeId: true } } },
    });
  } catch {
    return invalidToken(token);
  }
  if (!user || !user.isActive) return invalidToken(token);
  return { ...token, role: user.role, storeIds: user.storeAccess.map((s) => s.storeId), invalid: false };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { storeAccess: { include: { store: true } } },
        });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeIds: user.storeAccess.map((sa) => sa.storeId),
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Baru login: authorize() barusan membaca user + toko dari DB.
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.storeIds = (user as any).storeIds;
        token.invalid = false;
        return token;
      }
      return refreshTokenAccess(token);
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any;
        u.id = token.id;
        if (token.invalid) {
          // Fail-closed: getSessionUser() menolak sesi ini (null -> 401).
          u.invalid = true;
          delete u.role;
          delete u.storeIds;
        } else {
          u.role = token.role;
          u.storeIds = token.storeIds;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
