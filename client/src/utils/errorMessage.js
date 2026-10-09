export function errorMessage(error) {
  return error
    ? error.response?.data?.error?.message ||
        error.message ||
        'Something went wrong.'
    : null;
}
