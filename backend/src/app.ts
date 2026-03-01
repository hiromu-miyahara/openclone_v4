import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import fs from "node:fs";
import YAML from "yaml";
import { HttpError } from "./lib/http.js";
import { apiRouter } from "./routes/api.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { requireAllowedOriginForStateChanging } from "./middleware/origin.js";
import { requestIdMiddleware } from "./middleware/requestId.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  const allowedOrigins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : isProduction
        ? []
        : ["http://localhost:5173", "http://127.0.0.1:5173"];

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new HttpError(403, "forbidden", "許可されていないオリジンです"));
      },
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-openclone-bootstrap-token"],
    }),
  );
  app.use(morgan("dev"));
  app.use(express.json({ limit: "2mb" }));
  app.use(requestIdMiddleware);

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/openapi.json", (_req, res, next) => {
    try {
      const candidates = [
        path.resolve(__dirname, "../../docs/contracts/openapi_v1.yaml"),
        path.resolve(__dirname, "../docs/contracts/openapi_v1.yaml"),
      ];
      const openapiPath = candidates.find((p) => fs.existsSync(p));
      if (!openapiPath) {
        throw new Error("openapi_v1.yaml not found");
      }
      const raw = fs.readFileSync(openapiPath, "utf-8");
      res.json(YAML.parse(raw));
    } catch (err) {
      next(err);
    }
  });

  const generatedCandidates = [path.resolve(__dirname, "../../experiments"), path.resolve(process.cwd(), "../experiments"), path.resolve(process.cwd(), "experiments")];
  const generatedRoot = generatedCandidates.find((p) => fs.existsSync(p));
  if (generatedRoot) {
    app.use("/generated", express.static(generatedRoot));
  }

  app.use("/api", requireAllowedOriginForStateChanging(allowedOrigins), apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
