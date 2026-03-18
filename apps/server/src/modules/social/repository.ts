import { db } from "../../db/pg";

interface PostRow {
  id: string;
  author_id: string;
  caption: string;
  image_url?: string;
  ride_id?: string;
  likes: number;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  message: string;
  created_at: string;
}

export async function listFeed(): Promise<PostRow[]> {
  const result = await db.query<PostRow>(
    `SELECT id, author_id, caption, image_url, ride_id, likes, created_at FROM posts ORDER BY created_at DESC LIMIT 200`,
  );
  return result.rows;
}

export async function createPost(input: {
  authorId: string;
  caption: string;
  imageUrl?: string;
  rideId?: string;
}): Promise<PostRow> {
  const result = await db.query<PostRow>(
    `INSERT INTO posts (author_id, caption, image_url, ride_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, author_id, caption, image_url, ride_id, likes, created_at`,
    [input.authorId, input.caption, input.imageUrl ?? null, input.rideId ?? null],
  );
  return result.rows[0];
}

export async function findPostById(id: string): Promise<PostRow | null> {
  const result = await db.query<PostRow>(`SELECT id, author_id, caption, image_url, ride_id, likes, created_at FROM posts WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] ?? null;
}

export async function createComment(input: { postId: string; authorId: string; message: string }): Promise<CommentRow> {
  const result = await db.query<CommentRow>(
    `INSERT INTO post_comments (post_id, author_id, message)
     VALUES ($1, $2, $3)
     RETURNING id, post_id, author_id, message, created_at`,
    [input.postId, input.authorId, input.message],
  );
  return result.rows[0];
}

export async function listComments(postId: string): Promise<CommentRow[]> {
  const result = await db.query<CommentRow>(
    `SELECT id, post_id, author_id, message, created_at FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC`,
    [postId],
  );
  return result.rows;
}
