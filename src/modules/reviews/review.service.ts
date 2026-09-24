import "server-only";

import { prisma } from "@/lib/db/prisma";

import { averageRating, type CreateReviewInput } from "./schemas";

export async function listProductReviews(productId: string) {
  return prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getProductRating(productId: string) {
  const reviews = await prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    select: { rating: true },
  });
  return {
    average: averageRating(reviews.map((review) => review.rating)),
    count: reviews.length,
  };
}

export async function createReview(
  input: CreateReviewInput,
  params: { userId?: string | null; authorName: string },
) {
  return prisma.review.create({
    data: {
      productId: input.productId,
      userId: params.userId ?? null,
      authorName: params.authorName,
      rating: input.rating,
      title: input.title ?? null,
      comment: input.comment ?? null,
      status: "PENDING",
    },
  });
}

export async function listPendingReviews() {
  return prisma.review.findMany({
    where: { status: "PENDING" },
    include: { product: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function moderateReview(
  reviewId: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
) {
  return prisma.review.update({ where: { id: reviewId }, data: { status } });
}
