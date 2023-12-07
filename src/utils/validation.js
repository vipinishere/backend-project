const validateEmail = function (email) {
	// Regular expression for a simple email validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	// Test the email against the regular expression
	return emailRegex.test(email);
};

export { validateEmail };
