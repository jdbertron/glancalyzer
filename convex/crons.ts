import { cronJobs } from "convex/server";

const crons = cronJobs();

// Note: Removed cleanup cron jobs since we're keeping all pictures
// for training data collection. Rate limiting is now handled per-upload.

export default crons;
