// Helpers shared by the real backend and the test backend.

// Invite codes: 10 characters, no look-alikes (0/O, 1/l/I).
export function randomCode(len = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Turn Firebase error codes into sentences people understand.
export function friendlyError(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/missing-password': 'Please enter your password.',
    'auth/weak-password': 'The password needs at least 6 characters.',
    'auth/email-already-in-use': 'There is already an account with this email. Try signing in instead.',
    'auth/invalid-credential': 'Email or password is wrong.',
    'auth/wrong-password': 'Email or password is wrong.',
    'auth/user-not-found': 'There is no account with this email yet. Create one below.',
    'auth/too-many-requests': 'Too many tries. Please wait a moment and try again.',
    'auth/network-request-failed': 'No connection. Check your signal and try again.',
    'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
    'auth/cancelled-popup-request': 'The Google window was closed before finishing.',
    'auth/popup-blocked': 'Google sign-in couldn\'t open here. Please use email and password instead.',
    'auth/operation-not-supported-in-this-environment': 'Google sign-in doesn\'t work in this view. Please use email and password.',
    'auth/unauthorized-domain': 'This web address isn\'t allowed for logins yet (Firebase → Authentication → Settings → Authorized domains).',
    'permission-denied': 'You don\'t have permission to do that.',
    'unavailable': 'No connection right now. Your change will be saved when you\'re back online.'
  };
  return map[code] || (err && err.message) || 'Something went wrong. Please try again.';
}
