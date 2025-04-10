export const isError = (error: unknown): error is Error => {
	return error instanceof Error;
};

export const errorMessage = (error: unknown): string => {
	return isError(error) ? error.message : String(error);
};

export const errorName = (error: unknown): string => {
	return isError(error) ? error.name : String(error);
};
