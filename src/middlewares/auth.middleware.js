import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
	try {
		const token =
			req.cookies?.accessToken ||
			req.headers["authorization"].replace("Bearer ", "");

		if (!token) {
			throw new ApiError(401, "Unauthorized Request");
		}

		const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		if (!decodedToken) {
			throw new ApiError(403, "Invalid token");
		}

		const user = await User.findById(decodedToken._id).select(
			"-password -refreshToken"
		);

		if (!user) {
			// disscuss about frontend
			throw new ApiError(401, "Invalid AccessToken");
		}

		req.user = user;
		next();
	} catch (err) {
		throw new ApiError(401, err?.message || "Invalid AccessToken");
	}
});
