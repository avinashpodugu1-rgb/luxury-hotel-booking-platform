import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  ConfirmationResult,
  UserCredential
} from "firebase/auth";
import { auth } from "./firebase";

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

/**
 * Signs up a new user using Email and Password.
 */
export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && credential.user) {
    await updateProfile(credential.user, { displayName });
  }
  return credential;
}

/**
 * Signs in an existing user using Email and Password.
 */
export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Signs in a user using Google OAuth popup.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

/**
 * Sets up reCAPTCHA verifier for Phone Authentication.
 * @param containerId The ID of the HTML element where the reCAPTCHA button is rendered.
 */
export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved, allow signInWithPhoneNumber.
    },
    "expired-callback": () => {
      // Response expired. Ask user to solve reCAPTCHA again.
    }
  });
}

/**
 * Initiates the Phone Authentication process by sending an SMS verification code.
 */
export async function signInWithPhone(phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

/**
 * Confirms the SMS code received by the user and logs them in.
 */
export async function confirmPhoneCode(confirmationResult: ConfirmationResult, code: string): Promise<UserCredential> {
  return confirmationResult.confirm(code);
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOutUser(): Promise<void> {
  return signOut(auth);
}
