import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired pictures every hour
// - Unregistered users: files deleted after 1 day
// - Free tier users: files deleted after 7 days
// - Premium/Professional users: files kept indefinitely
crons.interval(
  "cleanup expired pictures",
  { hours: 1 },
  internal.pictures.cleanupExpiredPictures,
  {}
);

export default crons;
