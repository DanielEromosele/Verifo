const TOKEN_KEY = "verifo_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, { method = "GET", body, headers = {}, params } = {}) {
  const query = params
    ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")).toString()
    : "";
  const token = getToken();
  const res = await fetch(`/api/v1${path}${query}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: text } };
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.error || res.statusText;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function upload(path, { file, extra } = {}) {
  const form = new FormData();
  form.append("file", file);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) form.append(k, String(v));
  }
  const res = await fetch(`/api/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: text } };
    }
  }
  if (!res.ok) {
    const message = data?.error?.message || data?.error || res.statusText;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}