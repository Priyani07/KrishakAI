import type { Application } from "express";
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, stored: string): Promise<boolean>;
export declare function isAdmin(user: { role?: string } | null | undefined): boolean;
export declare function authenticateCommunityToken(token: string): Promise<{
  id: number;
  email: string;
  role: string;
  farm_name: string;
} | null>;
export declare function communityDiscussionExists(
  discussionId: string | number,
): Promise<boolean>;
export declare function registerCommunityRoutes(app: Application): void;
