import { z } from "zod";

export const createReviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  comment: z.string().max(1000).optional().nullable(),
});

export const moderateReviewSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / ratings.length) * 10) / 10;
}
