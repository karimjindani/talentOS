/**
 * Slug Generator for Graduate Profiles
 * Generates URL-safe slugs from names
 */

import { prisma } from "./client";

/**
 * Generate a URL-safe slug from a name
 * Example: "John Smith" -> "john-smith"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w-]/g, "") // Remove special characters
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug for a graduate profile
 * If slug already exists, append a number
 */
export async function generateUniqueSlug(name: string): Promise<string> {
  const slug = generateSlug(name) || "graduate";
  let counter = 1;
  let uniqueSlug = slug;

  // Check if slug already exists
  while (
    await prisma.graduateProfile.findUnique({
      where: { slug: uniqueSlug },
    })
  ) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  return uniqueSlug;
}

export default {
  generateSlug,
  generateUniqueSlug,
};
