import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateEmail } from "../utils/validation.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
	try {
		const user = await User.findById(userId);
		const accessToken = await user.generateAccessToken();
		const refreshToken = await user.generateRefreshToken();

		user.refreshToken = refreshToken;
		await user.save({ validateBeforeSave: false });

		return {
			accessToken,
			refreshToken,
		};
	} catch (err) {
		console.log(err);
		res
			.status(500)
			.json(
				new ApiError(
					500,
					"Something went wrong while generationg refresh and access tokens"
				)
			);
	}
};

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

const loginUser = asyncHandler(async (req, res) => {
	// req body -> data
	// username or email
	// find the user
	// password check
	// access and refresh token
	// send cookie

	const { username, password } = req.body;

	if ([username, password].some((value) => value === "")) {
		return res
			.status(200)
			.json(
				new ApiError(400, "Required Information is missing", ["Bad Request"])
			);
	}

	const user = await User.findOne({
		$or: [{ email: username }, { username: email }],
	});

	if (!user) {
		res.status(200).send("user doesn't exist!");
	}

	const isPasswordValid = await user.isPasswordCorrect(password);

	if (!isPasswordValid) {
		res.status(401).json(new ApiError(401, "Invalid user credentials"));
	}

	const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
		user._id
	);

	const loggedInUser = await User.findById(user._id);

	const options = {
		httpOnly: true, //it help to prevent to modification of cookie in user end, now the cookie only being modify from server
		secure: true,
	};

	return res
		.status(200)
		.cookie("accessToken", accessToken, options)
		.cookie("refreshToken", refreshToken, options)
		.json(
			new ApiResponse(
				200,
				{
					user: loggedInUser,
					accessToken,
					refreshToken,
				},
				"user logged in successfully"
			)
		);
});

const logoutUser = asyncHandler(async (req, res) => {
	const user = req.user;
	await User.findByIdAndUpdate(
		user._id,
		{
			$set: { refreshToken: undefined },
		},
		{ new: true }
	);

	const options = {
		httpOnly: true,
		secure: true,
	};

	res
		.status(200)
		.clearCookie("accessToken", options)
		.clearCookie("refreshToken", options)
		.json(new ApiResponse(200, {}, "user logout successfully"));
});

export { registerUser, loginUser, logoutUser };
