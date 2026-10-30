let cached: Promise<boolean> | null = null;

export function helloAvailable() {
  cached ??= (async () => {
    try {
      return Boolean(await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.());
    } catch {
      return false;
    }
  })();
  return cached;
}
