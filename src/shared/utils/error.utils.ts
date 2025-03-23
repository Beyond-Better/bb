export const isError = (error: unknown): error is Error => {
	return error instanceof Error;
};

export const errorMessage = (error: unknown): string => {
	return isError(error) ? error.message : String(error);
};
