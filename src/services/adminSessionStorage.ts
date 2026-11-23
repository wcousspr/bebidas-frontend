const KEY = "codigo-dos-bares-admin-token";

export function readAdminToken() {
  try {
    return { token: window.sessionStorage.getItem(KEY), available: true };
  } catch {
    return { token: null, available: false };
  }
}

export function saveAdminToken(token: string) {
  try {
    window.sessionStorage.setItem(KEY, token);
    return true;
  } catch {
    clearAdminToken();
    return false;
  }
}

export function clearAdminToken() {
  try {
    window.sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
