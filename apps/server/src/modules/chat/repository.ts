import { db } from "../../db/pg";

interface ConversationRow {
  id: string;
  type: "personal" | "group" | "help";
  name?: string;
  created_by: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface HelpRequestRow {
  id: string;
  requester_id: string;
  destination_city: string;
  destination_state: string;
  message: string;
  status: "open" | "matched" | "closed";
  helper_user_id?: string;
  conversation_id?: string;
  created_at: string;
}

export async function createConversation(input: {
  type: "personal" | "group" | "help";
  name?: string;
  createdBy: string;
  memberIds: string[];
}): Promise<ConversationRow> {
  await db.query("BEGIN");
  try {
    const created = await db.query<ConversationRow>(
      `INSERT INTO conversations (type, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, type, name, created_by, created_at`,
      [input.type, input.name ?? null, input.createdBy],
    );

    const allMembers = Array.from(new Set([input.createdBy, ...input.memberIds]));
    for (const userId of allMembers) {
      await db.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [created.rows[0].id, userId],
      );
    }

    await db.query("COMMIT");
    return created.rows[0];
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

export async function findPersonalConversation(userIdA: string, userIdB: string): Promise<ConversationRow | null> {
  const result = await db.query<ConversationRow>(
    `SELECT c.id, c.type, c.name, c.created_by, c.created_at
       FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
      WHERE c.type = 'personal'
      LIMIT 1`,
    [userIdA, userIdB],
  );
  return result.rows[0] ?? null;
}

export async function listConversations(userId: string): Promise<Array<ConversationRow & { member_ids: string[]; last_message?: string }>> {
  const result = await db.query<ConversationRow & { member_ids: string[]; last_message?: string }>(
    `SELECT c.id, c.type, c.name, c.created_by, c.created_at,
            array_remove(array_agg(cm.user_id), NULL) AS member_ids,
            (
              SELECT m.content
              FROM chat_messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ) AS last_message
       FROM conversations c
       JOIN conversation_members self_cm ON self_cm.conversation_id = c.id AND self_cm.user_id = $1
       LEFT JOIN conversation_members cm ON cm.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function isConversationMember(conversationId: string, userId: string): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2
    ) AS exists`,
    [conversationId, userId],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function listConversationMemberIds(conversationId: string): Promise<string[]> {
  const result = await db.query<{ user_id: string }>(
    `SELECT user_id FROM conversation_members WHERE conversation_id = $1`,
    [conversationId],
  );
  return result.rows.map((row) => row.user_id);
}

export async function createMessage(input: {
  conversationId: string;
  senderId: string;
  content: string;
}): Promise<MessageRow> {
  const result = await db.query<MessageRow>(
    `INSERT INTO chat_messages (conversation_id, sender_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, sender_id, content, created_at`,
    [input.conversationId, input.senderId, input.content],
  );
  return result.rows[0];
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const result = await db.query<MessageRow>(
    `SELECT id, conversation_id, sender_id, content, created_at
       FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT 500`,
    [conversationId],
  );
  return result.rows;
}

export async function createHelpRequest(input: {
  requesterId: string;
  destinationCity: string;
  destinationState: string;
  message: string;
}): Promise<HelpRequestRow> {
  const result = await db.query<HelpRequestRow>(
    `INSERT INTO help_requests (requester_id, destination_city, destination_state, message, status)
     VALUES ($1, $2, $3, $4, 'open')
     RETURNING id, requester_id, destination_city, destination_state, message, status, helper_user_id, conversation_id, created_at`,
    [input.requesterId, input.destinationCity, input.destinationState, input.message],
  );
  return result.rows[0];
}

export async function listOpenHelpRequests(city?: string, state?: string): Promise<HelpRequestRow[]> {
  const result = await db.query<HelpRequestRow>(
    `SELECT id, requester_id, destination_city, destination_state, message, status, helper_user_id, conversation_id, created_at
       FROM help_requests
      WHERE status = 'open'
        AND ($1::text IS NULL OR destination_city = $1)
        AND ($2::text IS NULL OR destination_state = $2)
      ORDER BY created_at DESC`,
    [city ?? null, state ?? null],
  );
  return result.rows;
}

export async function getHelpRequestById(id: string): Promise<HelpRequestRow | null> {
  const result = await db.query<HelpRequestRow>(
    `SELECT id, requester_id, destination_city, destination_state, message, status, helper_user_id, conversation_id, created_at
       FROM help_requests WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function attachHelpConversation(input: {
  helpRequestId: string;
  helperUserId: string;
  conversationId: string;
}): Promise<void> {
  await db.query(
    `UPDATE help_requests
        SET status = 'matched', helper_user_id = $2, conversation_id = $3
      WHERE id = $1`,
    [input.helpRequestId, input.helperUserId, input.conversationId],
  );
}
