# Mechanics Mate API Documentation

**Version**: 1.0.0
**Last Updated**: October 27, 2025
**Base URL**: `https://api.mechanics-mate.app` (Production) | `http://localhost:3000` (Development)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Error Handling](#error-handling)
3. [Rate Limiting](#rate-limiting)
4. [Endpoints](#endpoints)
   - [Authentication](#auth-endpoints)
   - [Subscriptions](#subscription-endpoints)
   - [Chat/AI](#chat-endpoints)
   - [Admin](#admin-endpoints)
   - [Logs](#logs-endpoints)

---

## Authentication

### JWT Bearer Token

All protected endpoints require a JWT token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

### Token Acquisition

Tokens are obtained during login or signup at `/api/auth/login` or `/api/auth/signup`.

### CSRF Protection

State-changing operations (POST, PUT, DELETE) require CSRF token validation:

1. GET `/api/auth/csrf-token` to receive a CSRF token
2. Include token in `_csrf` field in request body or `X-CSRF-Token` header

### Token Blacklist

Tokens are automatically blacklisted on logout. Attempting to use a blacklisted token will return `401 TOKEN_REVOKED`.

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Description of error",
  "code": "ERROR_CODE",
  "details": [...]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation failed) |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `429` | Too Many Requests (rate limit exceeded) |
| `500` | Internal Server Error |

### Common Error Codes

```
VALIDATION_ERROR - Input validation failed
TOKEN_EXPIRED - JWT token expired
TOKEN_REVOKED - Token blacklisted after logout
CSRF_TOKEN_INVALID - CSRF validation failed
INSUFFICIENT_QUOTA - Message quota exceeded
SUBSCRIPTION_REQUIRED - Active subscription needed
PAYMENT_FAILED - Stripe payment declined
```

---

## Rate Limiting

### API Endpoints

- **General API**: 50 requests per 15 minutes per IP
- **Chat Endpoint**: 10 requests per 1 minute per IP
- **Auth Endpoints**: 5 requests per 15 minutes per IP (only counts failures)

Response includes rate limit headers:

```http
RateLimit-Limit: 50
RateLimit-Remaining: 45
RateLimit-Reset: 1635283200
```

---

## Endpoints

### Auth Endpoints

#### 1. Sign Up

Create a new user account.

```http
POST /api/auth/signup
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "_csrf": "csrf_token_from_/csrf-token"
}
```

**Response** (201):
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "message": "Account created successfully. Please check your email to verify your account."
}
```

**Validation Rules**:
- `email`: Valid email format, unique
- `password`: Minimum 8 characters
- `name`: Optional, maximum 100 characters

---

#### 2. Login

Authenticate with email and password.

```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "_csrf": "csrf_token"
}
```

**Response** (200):
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "hasSubscription": true,
  "subscription": {
    "id": "uuid",
    "plan_id": "professional",
    "status": "active",
    "current_period_end": "2025-11-27T15:00:00Z"
  }
}
```

---

#### 3. Get CSRF Token

Retrieve a CSRF token for state-changing operations.

```http
GET /api/auth/csrf-token
```

**Response** (200):
```json
{
  "csrfToken": "TSuW22JS-0Hssl00O7VXbriHhsVqacQdxRyY"
}
```

---

#### 4. Get Current User

Get authenticated user's profile and subscription info.

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "subscription": {
    "id": "uuid",
    "plan_id": "professional",
    "status": "active",
    "current_period_start": "2025-10-27T15:00:00Z",
    "current_period_end": "2025-11-27T15:00:00Z"
  },
  "usage": {
    "message_count": 42,
    "month": "2025-10"
  },
  "isAdmin": false
}
```

---

#### 5. Logout

Invalidate the current session and blacklist the token.

```http
POST /api/auth/logout
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "_csrf": "csrf_token"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### 6. Verify Email

Verify user's email with a token from verification email.

```http
POST /api/auth/verify-email
Content-Type: application/json
```

**Request Body**:
```json
{
  "token": "verification_token_from_email"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Email verified successfully",
  "email": "user@example.com"
}
```

---

#### 7. Resend Verification Email

Request a new verification email (authenticated users only).

```http
POST /api/auth/resend-verification
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "Verification email sent",
  "verificationLink": "http://localhost:3000/verify-email?token=..." (development only)
}
```

---

### Subscription Endpoints

#### 1. Create Checkout Session

Initiate a subscription purchase.

```http
POST /api/subscriptions/create-checkout
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "planId": "professional"
}
```

**Valid Plan IDs**: `starter`, `professional`, `workshop`

**Response** (200):
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

---

#### 2. Create Billing Portal Session

Open Stripe billing portal for subscription management.

```http
POST /api/subscriptions/create-portal
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

---

#### 3. Webhook Handler

Stripe webhook for subscription events.

```http
POST /api/subscriptions/webhook
```

**Stripe Events Handled**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Features**:
- Automatic idempotency (prevents duplicate processing)
- Event logging for audit trail
- Database updates for subscription status

---

### Chat Endpoints

#### 1. Send Message (AI Chat)

Get AI-powered automotive advice.

```http
POST /api/chat
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "[Vehicle: 2020 Honda Civic 2.0L Gas] Why is my car making a knocking sound?",
  "conversationHistory": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": "Previous response"
    }
  ]
}
```

**Response** (200):
```json
{
  "response": "Based on the forum discussions for 2020 Honda Civics...",
  "quotaRemaining": 98,
  "quotaLimit": 100
}
```

**Requirements**:
- Active subscription (message quota must be available)
- Valid vehicle context in message format

**Quota Limits** (per month):
- `starter`: 100 messages
- `professional`: 500 messages
- `workshop`: Unlimited

---

### Admin Endpoints

#### 1. Get Application Logs

Retrieve application event logs (admin only).

```http
GET /api/admin/logs?type=all&limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters**:
- `type`: `all`, `login`, `payment`, `subscription`, `error` (default: all)
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

**Response** (200):
```json
{
  "logs": [
    {
      "id": "uuid",
      "title": "Login Success",
      "message": "User logged in successfully",
      "logType": "LOGIN",
      "userId": "uuid",
      "createdAt": "2025-10-27T15:00:00Z"
    }
  ],
  "total": 1500,
  "limit": 50,
  "offset": 0
}
```

---

#### 2. View Dashboard Subscription Data

Get subscription analytics (admin only).

```http
GET /api/admin/subscription-stats
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "totalSubscriptions": 1250,
  "activeSubscriptions": 1150,
  "canceledSubscriptions": 100,
  "byPlan": {
    "starter": 400,
    "professional": 600,
    "workshop": 150
  },
  "mrr": 15750.00,
  "churnRate": 8.0
}
```

---

### Logs Endpoints

#### 1. Get Comprehensive Logs

```http
GET /api/logs?type=error&limit=100
Authorization: Bearer <token>
```

**Log Types**: `all`, `login`, `payment`, `subscription`, `error`, `security`

**Response** (200):
```json
{
  "logs": [...],
  "total": 5000,
  "hasMore": true
}
```

---

## Rate Limit Examples

### Hitting Rate Limit

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 50
RateLimit-Remaining: 0
RateLimit-Reset: 1635283200
```

**Response Body**:
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": "15 minutes"
}
```

---

## Webhook Integration

### Stripe Webhook Signature Verification

Stripe includes a signature in the `stripe-signature` header. The server automatically verifies this signature using your `STRIPE_WEBHOOK_SECRET`.

### Webhook Event Structure

```json
{
  "id": "evt_1234567890",
  "type": "customer.subscription.updated",
  "created": 1635283200,
  "data": {
    "object": {
      "id": "sub_1234567890",
      "customer": "cus_1234567890",
      "status": "active",
      "current_period_start": 1635283200,
      "current_period_end": 1638061200
    }
  }
}
```

### Idempotency

Webhooks are idempotent. Duplicate events with the same `id` are automatically detected and ignored.

---

## Best Practices

### Security

1. **Always use HTTPS** in production
2. **Never expose tokens** in logs or error messages
3. **Verify CSRF tokens** for all state-changing operations
4. **Validate input** on the frontend and backend
5. **Use rate limiting** to prevent brute force attacks

### Performance

1. **Paginate large result sets** (use `limit` and `offset`)
2. **Cache responses** when appropriate (CORS headers allow this)
3. **Batch requests** when possible to reduce API calls
4. **Monitor rate limits** and implement exponential backoff

### Error Handling

1. **Check HTTP status codes** to determine success/failure
2. **Handle rate limit responses** with exponential backoff
3. **Log errors** for debugging and monitoring
4. **Provide user-friendly** error messages

---

## SDKs & Libraries

### JavaScript/Node.js

```javascript
// Fetch with auth
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}
response = requests.post('http://localhost:3000/api/chat',
    json=data, headers=headers)
```

---

## Changelog

### v1.0.0 (October 27, 2025)

- Initial API release
- Authentication endpoints (signup, login, logout, verify-email)
- Subscription management endpoints
- Chat/AI endpoint
- Admin analytics endpoints
- CSRF protection
- Token blacklist on logout
- Webhook idempotency for Stripe events
- Comprehensive error handling
- Rate limiting on all endpoints

---

## Support

For API questions or issues:
- **Email**: support@mechanics-mate.app
- **Documentation**: https://mechanics-mate.app/api-docs
- **Status Page**: https://status.mechanics-mate.app

---

## License

API Documentation © 2025 Mechanics Mate. All rights reserved.
