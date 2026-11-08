/** Identity username: 5–100 chars, charset [a-zA-Z0-9_-], which also rejects email format. */
export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 100;
export const USERNAME_PATTERN = "[a-zA-Z0-9_-]{5,100}";
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{5,100}$/;

export const isValidUsername = (username: string): boolean => USERNAME_REGEX.test(username);
