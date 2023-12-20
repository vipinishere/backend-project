const asyncHandler = (requestedHandler) => {
	return (req, res, next) =>
		Promise.resolve(requestedHandler(req, res, next)).catch((err) => {
			console.log("[**err**]:>>> \n", err);
			return next(err);
		});
};

export { asyncHandler };
