import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

// middlewares
app.use(express.json({ limit: "16kb" }));
app.use(
	cors({
		origin: process.env.CORS_ORIGIN,
		credentials: true,
	})
);
app.use(
	express.urlencoded({
		extended: true,
		limit: "16kb",
		type: "application/x-www-form-urlencoded",
	})
);
app.use(express.static("public"));
app.use(cookieParser());

// routes
app.use("");

export default app;
