/** Identity username: length only (min 5, max 100). No email-format or charset restriction. */
export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 100;

export const isValidUsername = (username: string): boolean => {
  const n = username.trim().length;
  return n >= USERNAME_MIN_LENGTH && n <= USERNAME_MAX_LENGTH;
};
