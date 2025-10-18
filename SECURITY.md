# Security Guidelines

## API Key Security

### Important: Rotate Your API Key

⚠️ **CRITICAL**: If you have committed your `.env` file to a Git repository or shared it publicly, your Anthropic API key has been exposed and needs to be rotated immediately.

### How to Rotate Your API Key

1. **Revoke the old key**:
   - Go to [Anthropic Console - API Keys](https://console.anthropic.com/settings/keys)
   - Find your current API key
   - Click "Delete" or "Revoke" to disable it

2. **Generate a new key**:
   - Click "Create Key" or "New API Key"
   - Copy the new key (it will only be shown once)

3. **Update your .env file**:
   ```bash
   # Replace the old key with the new one
   ANTHROPIC_API_KEY=sk-ant-api03-YOUR_NEW_KEY_HERE
   ```

4. **Restart the server**:
   ```bash
   # Stop the current server (Ctrl+C)
   npm start
   ```

### Best Practices

1. **Never commit `.env` files**:
   - The `.gitignore` file should include `.env`
   - Use `.env.example` as a template (without real keys)

2. **Keep your API key secret**:
   - Don't share your `.env` file
   - Don't paste your API key in public forums or chats
   - Don't commit it to version control

3. **Use environment variables in production**:
   - On hosting platforms, set environment variables through their dashboard
   - Never hardcode API keys in your code

4. **Monitor your API usage**:
   - Check the [Anthropic Console](https://console.anthropic.com/settings/usage) regularly
   - Set up usage alerts if available
   - Look for unexpected spikes in usage

5. **Rotate keys periodically**:
   - Consider rotating your API key every 90 days
   - Rotate immediately if you suspect it may have been exposed

### What to Do if Your Key is Compromised

If you believe your API key has been compromised:

1. **Immediately revoke the key** in the Anthropic Console
2. **Generate a new key** and update your `.env` file
3. **Check your usage** for any unauthorized activity
4. **Review your git history** to ensure no keys are committed
5. **Consider using `git filter-branch`** or similar tools to remove sensitive data from git history

## Additional Security Measures

### For Development

- Use separate API keys for development and production
- Keep your `.env.example` file updated as a template
- Never log API keys in console or files

### For Production

- Use environment variables provided by your hosting platform
- Enable CORS properly to only allow your domain
- Consider implementing rate limiting on your server
- Use HTTPS in production (never HTTP for API requests)

### Server Security

- Keep dependencies updated (`npm audit` and `npm update`)
- Use rate limiting to prevent API abuse
- Implement proper error handling to avoid exposing sensitive info
- Consider adding authentication for your API endpoint in production

## Reporting Security Issues

If you discover a security vulnerability, please:
1. Do NOT open a public issue
2. Contact the maintainer privately
3. Provide details about the vulnerability
4. Wait for a response before disclosing publicly
