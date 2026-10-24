import { NextRequest } from 'next/server';
import { db, save } from '@/lib/db';
import { ok, bad, parseBody } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const recipientId = searchParams.get('recipientId');

  const store = db();
  let list = store.notifications;
  if (recipientId) {
    list = list.filter((n) => n.recipientId === recipientId);
  }

  return ok(list.slice(0, 50));
}

export async function PATCH(req: NextRequest) {
  const data = await parseBody<{ recipientId: string }>(req);
  if (!data?.recipientId) {
    return bad('Missing recipientId.');
  }

  const store = db();
  let count = 0;
  for (const n of store.notifications) {
    if (n.recipientId === data.recipientId && !n.read) {
      n.read = true;
      count++;
    }
  }

  save();
  return ok({ markedRead: count });
}
