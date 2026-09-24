export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(
      problem?.detail || `Không thể kết nối dịch vụ (HTTP ${response.status})`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
