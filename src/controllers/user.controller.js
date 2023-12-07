import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateEmail } from "../utils/validation.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
	// get user details from frontend
	// validation
	// check if user already exists: username, email
	// check for images, check for avatar
	// upload them to cloudinary
	// create user object - create entry in db
	// remove password and refresh token field response
	// check for user creation
	// return response

	const { fullname, email, username, password } = req.body;

	if (
		[fullname, email, username, password].some((field) => {
			field.trim() === "";
		})
	) {
		throw new ApiError(400, "Required information is missing or invalid.", [
			"Bad Request",
		]);
	}

	if (!validateEmail(email)) {
		throw new ApiError(400, "Email or Username is missing or invalid.", [
			"Bad Request",
		]);
	}

	const existedUser = await User.findOne({
		$or: [email, username],
	});

	if (existedUser) {
		throw new ApiError(409, "User with the provided email already exists.", [
			"Conflict",
		]);
	}

	const avatarLocalPath = req.files?.avatar[0]?.path;
	const coverImageLocalPath = req.files?.coverImage[0]?.path;

	if (!avatarLocalPath || !coverImageLocalPath) {
		throw new ApiError(400, "Avatar is missing or invalid.", ["Bad Request"]);
	}

	const avatar = await uploadOnCloudinary(avatarLocalPath);
	const coverImage = await uploadOnCloudinary(coverImageLocalPath);

	if (!avatar || !coverImage) {
		throw new ApiError(400, "Avatar is missing or invalid.", ["Bad Request"]);
	}

	const user = await User.create({
		username: username.lowerCase(),
		fullName: fullname,
		email,
		password,
		avatar: avatar,
		coverImage: coverImage,
	});

	const createdUser = await User.findById(user._id).select(
		"-password -refreshToken"
	);

	if (!createdUser) {
		throw new ApiError(500, "Something went wrong while registering the user", [
			"Internal Server Error",
		]);
	}

	res
		.status(201)
		.json(new ApiResponse(200, createdUser, "user register successfully"));
});

export { registerUser };
