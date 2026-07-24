import { getStorageItem, setStorageItem, removeStorageItem } from "@/lib/safeStorage";

const isNode = typeof window === "undefined";

const toSnakeCase = (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase();

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) return defaultValue ?? null;
  const storageKey = `base44_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl && searchParam != null) {
    urlParams.delete(paramName);
    const nextQuery = urlParams.toString();
    const newUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam) {
    setStorageItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue != null && defaultValue !== "") {
    setStorageItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = getStorageItem(storageKey);
  return storedValue || null;
};

const getAppParams = () => {
  if (getAppParamValue("clear_access_token") === "true") {
    removeStorageItem("base44_access_token");
    removeStorageItem("token");
  }
  return {
    appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", {
      defaultValue: isNode ? "" : window.location.href,
    }),
    functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
    appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
  };
};


export const appParams = {
  ...getAppParams(),
};
