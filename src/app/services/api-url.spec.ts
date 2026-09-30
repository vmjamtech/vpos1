import { apiBaseUrl } from './api-url';

describe('apiBaseUrl', () => {
  it('builds an HTTPS origin for IPv4 and DNS hosts', () => {
    expect(apiBaseUrl('192.168.1.20', '3000')).toBe(
      'https://192.168.1.20:3000'
    );
    expect(apiBaseUrl('api.example.test', '443')).toBe(
      'https://api.example.test'
    );
  });

  it('supports IPv6 hosts', () => {
    expect(apiBaseUrl('::1', '3000')).toBe('https://[::1]:3000');
  });

  it('rejects missing or invalid server settings', () => {
    expect(() => apiBaseUrl('', '3000')).toThrowError(
      'A valid server IP address and port are required.'
    );
    expect(() => apiBaseUrl('192.168.1.20', 'bad')).toThrowError();
  });
});