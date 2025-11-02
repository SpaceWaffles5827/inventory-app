import { rateLimit } from "express-rate-limit";

export const rateLimitMiddle = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 20,
  message: {
    status: 429,
    message: "Too many attempts. Please try again ldate",
  },
  handler: (req, res) => {
    res.status(429).json({
      message: "To many atempts please try again later.",
    });
  },
});
