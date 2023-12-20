import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import logger from "morgan";
import { ApiError } from "./utils/ApiError.js";

//route

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
app.use(logger("dev"));

// routes
import userRoute from "./routes/user.route.js";
app.use("/api/v1", userRoute);

app.get("/", (req, res) => {
	return res.status(200).json({
		message: "home route is working",
	});
});

app.use((err, req, res, next) => {
	if (err instanceof ApiError) {
		// Handle the custom error class
		return res.status(err.statusCode).json(err);
	} else {
		// Handle other types of errors
		return res.status(500).json({ error: "Internal Server Error" });
	}
});
export default app;
