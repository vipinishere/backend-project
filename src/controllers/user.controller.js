import { asyncHandler } from "../utils/asyncHandler.js";

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
	console.log("email:", email);
});

export { registerUser };
