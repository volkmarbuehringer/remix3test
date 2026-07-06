export const PASSWORD_MIN_LENGTH = 10
const DIGIT_RE = /[0-9]/
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/

export function validatePasswordComplexity(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`
  }
  if (!DIGIT_RE.test(password)) {
    return 'Das Passwort muss mindestens eine Zahl enthalten.'
  }
  if (!SPECIAL_RE.test(password)) {
    return 'Das Passwort muss mindestens ein Sonderzeichen enthalten.'
  }
  return null
}
