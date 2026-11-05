const value = process.env.VITE_API_BASE_URL?.trim();

if (!value || !URL.canParse(value)) {
  console.error('Set VITE_API_BASE_URL to the HTTPS API base URL before building the mobile app.');
  process.exit(1);
}

const apiUrl = new URL(value);
if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
  console.error('VITE_API_BASE_URL must be an HTTPS URL without credentials, query, or fragment.');
  process.exit(1);
}
