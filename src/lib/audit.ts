import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { AuditAction } from "@prisma/client";

/** Catat 1 baris audit trail (Edit/Delete) — dipakai seragam di semua route yang punya CRUD. */
export async function logAudit(opts: {
  actor: SessionUser;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  storeId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: opts.actor.id,
      actorName: opts.actor.name,
      actorEmail: opts.actor.email,
      actorRole: opts.actor.role,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityLabel: opts.entityLabel,
      storeId: opts.storeId ?? null,
      reason: opts.reason ?? null,
      before: opts.before === undefined ? undefined : (opts.before as any),
      after: opts.after === undefined ? undefined : (opts.after as any),
    },
  });
}
