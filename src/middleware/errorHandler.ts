import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ error: "validation failed", details: err.flatten().fieldErrors });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal error" });
};
