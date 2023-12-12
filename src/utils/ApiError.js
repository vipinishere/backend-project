class ApiError extends Error {
	constructor(
		statusCode,
		message = "something went wrong !",
		errors = [],
		stack = ""
	) {
		super(message);
		this.statusCode = statusCode;
		this.success = false;
		this._message = message;
		this.data = null;
		this.errors = errors;
		this.stack = stack;
		if (stack) {
			this.stack = stack;
		} else {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

export { ApiError };
