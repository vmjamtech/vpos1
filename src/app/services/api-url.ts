export function apiBaseUrl(ip: string, port: string): string {
  const host = ip.trim();
  const portNumber = Number(port.trim());
  if (
    !host ||
    !Number.isInteger(portNumber) ||
    portNumber < 1 ||
    portNumber > 65535
  ) {
    throw new Error('A valid server IP address and port are required.');
  }

  const normalizedHost = host.includes(':') && !host.startsWith('[')
    ? `[${host}]`
    : host;
  const url = new URL(`https://${normalizedHost}:${portNumber}`);

  return url.origin;
}