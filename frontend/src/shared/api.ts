export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const requestId = crypto.randomUUID();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    const correlationId =
      problem?.requestId || response.headers.get("X-Request-ID") || requestId;
    const message =
      problem?.message ||
      problem?.detail ||
      `Không thể kết nối dịch vụ (HTTP ${response.status})`;
    throw new Error(`${message} Mã yêu cầu: ${correlationId}`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
