import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { createComment, createPost, findPostById, listComments, listFeed } from "./repository";
import { delCache, getJsonCache, setJsonCache } from "../../db/cache";

const createPostSchema = z.object({
  caption: z.string().min(1).max(500),
  imageUrl: z.string().url().optional(),
  rideId: z.string().optional(),
});

const commentSchema = z.object({
  message: z.string().min(1).max(300),
});

export const socialRouter = Router();
socialRouter.use(authGuard);

socialRouter.get("/feed", async (_req, res) => {
  const cacheKey = "feed:global";
  const cached = await getJsonCache<unknown[]>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const posts = await listFeed();
  const payload = posts.map((post) => ({
    id: post.id,
    authorId: post.author_id,
    caption: post.caption,
    imageUrl: post.image_url,
    rideId: post.ride_id,
    likes: post.likes,
    createdAt: post.created_at,
  }));

  await setJsonCache(cacheKey, payload, 30);
  res.json(payload);
});

socialRouter.post("/posts", async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const post = await createPost({
    authorId: req.auth!.userId,
    caption: parsed.data.caption,
    imageUrl: parsed.data.imageUrl,
    rideId: parsed.data.rideId,
  });

  await delCache("feed:global");
  res.status(201).json({
    id: post.id,
    authorId: post.author_id,
    caption: post.caption,
    imageUrl: post.image_url,
    rideId: post.ride_id,
    likes: post.likes,
    createdAt: post.created_at,
  });
});

socialRouter.post("/posts/:id/comment", async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const post = await findPostById(req.params.id);
  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const comment = await createComment({ postId: post.id, authorId: req.auth!.userId, message: parsed.data.message });

  res.status(201).json({
    id: comment.id,
    postId: comment.post_id,
    authorId: comment.author_id,
    message: comment.message,
    createdAt: comment.created_at,
  });
});

socialRouter.get("/posts/:id/comments", async (req, res) => {
  const comments = await listComments(req.params.id);
  res.json(
    comments.map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      authorId: comment.author_id,
      message: comment.message,
      createdAt: comment.created_at,
    })),
  );
});
