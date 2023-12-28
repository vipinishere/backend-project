import fs from "fs";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateEmail } from "../utils/validation.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { COOKIE_OPTIONS } from "../constants.js";

const generateAccessAndRefreshTokens = async (userId) => {
	try {
		const user = await User.findById(userId);

		if (!user) {
			throw new ApiError(401, "Unauthorized Request", ["Bad Request"]);
		}

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
		throw new ApiError(
			500,
			"Something went wrong while generationg refresh and access tokens"
		);
	}
};

const registerUser = asyncHandler(async (req, res, next) => {
	const { fullName, email, username, password } = req.body;
	const avatarLocalPath = req.files?.avatar[0]?.path;
	const coverImageLocalPath = req.files?.coverImage[0]?.path;

	if (!fullName || !email || !username || !password) {
		if (avatarLocalPath || coverImageLocalPath) {
			fs.unlinkSync(avatarLocalPath);
			fs.unlinkSync(coverImageLocalPath);
		}
		throw new ApiError(400, "Required Information is missing or invalid");
	}

	if (!validateEmail(email)) {
		if (avatarLocalPath) {
			fs.unlinkSync(avatarLocalPath);
		}

		if (coverImageLocalPath) {
			fs.unlinkSync(coverImageLocalPath);
		}

		throw new ApiError(400, "Email or Username is missing or invalid.", [
			"Bad Request",
		]);
	}

	const existedUser = await User.findOne({
		$or: [{ email }, { username }],
	});

	if (existedUser) {
		if (avatarLocalPath) {
			fs.unlinkSync(avatarLocalPath);
		}

		if (coverImageLocalPath) {
			fs.unlinkSync(coverImageLocalPath);
		}

		throw new ApiError(
			409,
			"User with the provided email or username already exists.",
			["Conflict"]
		);
	}

	if (!avatarLocalPath || !coverImageLocalPath) {
		throw new ApiError(400, "Avatar or CoverImage is missing or invalid", [
			"Bad Request",
		]);
	}

	const avatar = await uploadOnCloudinary(avatarLocalPath);
	const coverImage = await uploadOnCloudinary(coverImageLocalPath);

	fs.unlinkSync(avatarLocalPath);
	fs.unlinkSync(coverImageLocalPath);

	if (!avatar || !coverImage) {
		throw new ApiError(500, "Something went wrong!", ["Server Problem"]);
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
		throw new ApiError(400, "Required Information is missing", ["Bad Request"]);
	}

	const user = await User.findOne({
		$or: [{ email: username }, { username: username }],
	});

	if (!user) {
		return res
			.status(200)
			.json(new ApiError(200, "Username or Password is Invalid"));
	}

	const isPasswordValid = await user.isPasswordCorrect(password);

	if (!isPasswordValid) {
		return res.status(401).json(new ApiError(401, "Invalid user credentials"));
	}

	const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
		user._id
	);

	const loggedInUser = await User.findById(user._id).select(
		"-password -refreshToken"
	);

	return res
		.status(200)
		.cookie("accessToken", accessToken, COOKIE_OPTIONS)
		.cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
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

	res
		.status(200)
		.clearCookie("accessToken", COOKIE_OPTIONS)
		.clearCookie("refreshToken", COOKIE_OPTIONS)
		.json(new ApiResponse(200, {}, "user logout successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
	try {
		const incomingRefreshToken =
			req.cookies?.refreshToken || req.headers["authorization"].split(" ")[1];

		if (!incomingRefreshToken) {
			throw new ApiError(401, "Invalid RefreshToken", ["Unauthorized Request"]);
		}

		const decodedUser = jwt.verify(
			incomingRefreshToken,
			process.env.REFRESH_TOKEN_SECRET
		);

		const user = await User.findById(decodedUser?._id).select("-password");

		if (!user) {
			throw new ApiError(401, "Invalid RefreshToken", ["Unauthorized Request"]);
		}

		if (incomingRefreshToken !== user?.refreshToken) {
			throw new ApiError(401, "Refresh token is expired or used");
		}

		const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
			user._id
		);

		return res
			.status(200)
			.cookie("accessToken", accessToken, COOKIE_OPTIONS)
			.cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
			.json(
				new ApiResponse(
					200,
					{
						user: user,
						accessToken,
						refreshToken,
					},
					"AccessToken refreshed"
				)
			);
	} catch (error) {
		throw new ApiError(
			401,
			error?.message || "Refresh token is invalid, expired or used"
		);
	}
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
	const { oldPassword, newPassword } = req.body;

	if (!oldPassword || !newPassword) {
		throw new ApiError(403, "something is missing");
	}

	const user = await User.findById(req.user?._id);

	const isPasswordCorrect = user.isPasswordCorrect(oldPassword);

	if (!isPasswordCorrect) {
		throw new ApiError(401, "Old Password is incorrect");
	}

	user.password = newPassword;
	await user.save({ validateBeforeSave: false });

	return res
		.status(200)
		.json(
			new ApiResponse(
				200,
				req.user,
				"password changed successfully, please login"
			)
		);
});

const getCurrentUser = asyncHandler(async (req, res) => {
	return res.status(200).json(new ApiResponse(200, { user: req.user }));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
	const { fullName, email } = req.body;

	if (!(fullName && email)) {
		throw new ApiError(401, "All fields are important");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{ $set: { fullName, email } },
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(
			new ApiResponse(200, { user }, "Account Details Updated Successfully")
		);
});

const updateUserAvatar = asyncHandler(async (req, res) => {
	const avatarLocalPath = req.file?.path;

	if (!avatarLocalPath) {
		throw new ApiError(401, "Avatar file is missing");
	}

	const avatar = await uploadOnCloudinary(avatarLocalPath);

	if (!avatar.url) {
		throw new ApiError(500, "Error while uplaoding avatar file");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			$set: { avatar: avatar.url },
		},
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(new ApiResponse(200, { user }, "Avatar Updated Successfully"));
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
	const coverImageLocalPath = req.file?.path;

	if (!coverImageLocalPath) {
		throw new ApiError(401, "coverImage file is missing");
	}

	const coverImage = await uploadOnCloudinary(coverImageLocalPath);

	if (!coverImage.url) {
		throw new ApiError(500, "Error while Uploading coverImage file");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			$set: { coverImage: coverImage.url },
		},
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(new ApiResponse(200, { user }, "Avatar Updated Successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
	const { username } = req.params;

	if (!username) {
		throw new ApiError(400, "Username doesn't provided");
	}

	const channel = User.aggregate([
		{
			$match: {
				username: username?.toLowerCase(),
			},
		},
		{
			$lookup: {
				from: "subscriptions",
				localField: "_id",
				foreignField: "channel",
				as: "subscribers",
			},
		},
		{
			$lookup: {
				from: "subscriptions",
				localField: "_id",
				foreignField: "subscriber",
				as: "subscribedTo",
			},
		},
		{
			$addFields: {
				subscriberCount: {
					$size: "$subscribers",
				},
				channelsSubscribedToCount: {
					$size: "$subscribedTo",
				},
				isSubscribed: {
					$cond: {
						if: { $in: [req.user?._id, "$subscribers"] },
						then: true,
						else: false,
					},
				},
			},
		},
		{
			$project: {
				fullName: 1,
				email: 1,
				username: 1,
				avatar: 1,
				coverImage: 1,
				subscriberCount: 1,
				channelsSubscribedToCount: 1,
				isSubscribed: 1,
			},
		},
	]);

	console.log(channel);

	if (!channel?.length) {
		throw new ApiError(404, "channel doesn't exist");
	}

	return res
		.status(200)
		.json(
			new ApiResponse(200, channel[0], "user channel fatched successfully")
		);
});

export {
	registerUser,
	loginUser,
	logoutUser,
	refreshAccessToken,
	changeCurrentPassword,
	getCurrentUser,
	updateAccountDetails,
	updateUserAvatar,
	updateUserCoverImage,
};
