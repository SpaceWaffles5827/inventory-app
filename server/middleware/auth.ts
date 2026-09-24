import { Request, Response, NextFunction } from "express";
import { errorBody } from "../utils/http";

/** 401 JSON unless the request carries an authenticated session. */
export function isAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user) return next();
  res.status(401).json({ ...errorBody("Unauthorized"), data: null });
}
