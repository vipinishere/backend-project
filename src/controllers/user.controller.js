import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateEmail } from "../utils/validation.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
	const { fullName, email, username, password } = req.body;
	const avatarLocalPath = req.files?.avatar[0]?.path;
	const coverImageLocalPath = req.files?.coverImage[0]?.path;

	if (!fullName || !email || !username || !password) {
		if (avatarLocalPath || coverImageLocalPath) {
			fs.unlinkSync(avatarLocalPath);
			fs.unlinkSync(coverImageLocalPath);
		}
		return res
			.status(200)
			.json(new ApiError(400, "Required information is missing or invalid."));
	}

	if (!validateEmail(email)) {
		if (avatarLocalPath || coverImageLocalPath) {
			fs.unlinkSync(avatarLocalPath);
			fs.unlinkSync(coverImageLocalPath);
		}
		return res
			.status(200)
			.json(
				new ApiError(400, "Email or Username is missing or invalid.", [
					"Bad Request",
				])
			);
	}

	const existedUser = await User.findOne({
		$or: [{ email }, { username }],
	});

	if (existedUser) {
		if (avatarLocalPath || coverImageLocalPath) {
			fs.unlinkSync(avatarLocalPath);
			fs.unlinkSync(coverImageLocalPath);
		}
		return res
			.status(409)
			.json(
				new ApiError(
					409,
					"User with the provided email or username already exists.",
					["Conflict"]
				)
			);
	}

	if (!avatarLocalPath || !coverImageLocalPath) {
		return res
			.status(400)
			.json(
				new ApiError(400, "Avatar or CoverImage is missing or invalid", [
					"Bad Request",
				])
			);
	}

	const avatar = await uploadOnCloudinary(avatarLocalPath);
	const coverImage = await uploadOnCloudinary(coverImageLocalPath);

	fs.unlinkSync(avatarLocalPath);
	fs.unlinkSync(coverImageLocalPath);

	if (!avatar || !coverImage) {
		return res
			.status(500)
			.json(new ApiError(500, "Something went wrong!", ["Server Problem"]));
	}

	const user = await User.create({
		username: username.toLowerCase(),
		fullName,
		email,
		password,
		avatar: avatar.url,
		coverImage: coverImage.url,
	});

	const createdUser = await User.findById(user._id).select(
		"-password -refreshToken"
	);
	if (createdUser) {
		return res
			.status(201)
			.json(new ApiResponse(200, createdUser, "user register successfully"));
	} else {
		return res
			.status(500)
			.json(
				new ApiError(500, "Something went wrong while registering the user", [
					"Internal Server Error",
				])
			);
	}
});

const loginUser = asyncHandler(async (req, res, next) => {
	const { username, password } = req.body;
	console.log(username, password);
	res.status(200).send({ username, password });
});

export { registerUser, loginUser };

//{// get user details from frontend
// validation
// check if user already exists: username, email
// check for images, check for avatar
// upload them to cloudinary
// create user object - create entry in db
// remove password and refresh token field response
// check for user creation
// return response}

// if (
// 	[fullName, email, username, password].some((value) => value.trim() === "")
// ) {
// 	return res
// 		.status(200)
// 		.json(
// 			new ApiError(400, "Required information is missing or invalid.", [
// 				"Bad Request",
// 			])
// 		);
// }
