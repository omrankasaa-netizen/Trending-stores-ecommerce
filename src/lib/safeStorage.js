const memoryStorage = new Map();
let localStorageUsable;

function canUseLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const probe = "__ts_storage_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function hasLocalStorage() {
  if (localStorageUsable == null) localStorageUsable = canUseLocalStorage();
  return localStorageUsable;
}

export function getStorageItem(key) {
  if (!key) return null;
  if (hasLocalStorage()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Some in-app browsers can throw SecurityError mid-session.
      localStorageUsable = false;
    }
  }
  return memoryStorage.has(key) ? memoryStorage.get(key) : null;
}

export function setStorageItem(key, value) {
  if (!key) return;
  const text = String(value);
  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(key, text);
      return;
    } catch {
      localStorageUsable = false;
    }
  }
  memoryStorage.set(key, text);
}

export function removeStorageItem(key) {
  if (!key) return;
  if (hasLocalStorage()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      localStorageUsable = false;
    }
  }
  memoryStorage.delete(key);
}
