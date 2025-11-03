const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid initialized with API key');
} else {
    console.warn('⚠️  SENDGRID_API_KEY not configured. Email sending disabled (development mode).');
}

/**
 * Send email verification email
 * @param {string} email - User's email address
 * @param {string} verificationLink - Full URL to verification page
 * @param {string} name - User's name (optional)
 * @returns {Promise<boolean>} Success status
 */
async function sendVerificationEmail(email, verificationLink, name = null) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn(`📧 [DEV MODE] Verification link for ${email}: ${verificationLink}`);
        return false;
    }

    const msg = {
        to: email,
        from: {
            email: process.env.SENDGRID_FROM_EMAIL || 'noreply@car-mechanic.co.uk',
            name: process.env.SENDGRID_FROM_NAME || 'Car Mechanic'
        },
        subject: 'Verify Your Car Mechanic Email',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #333;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f9f9f9;
                    }
                    .header {
                        background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
                        color: white;
                        padding: 30px 20px;
                        text-align: center;
                        border-radius: 8px 8px 0 0;
                    }
                    .content {
                        background-color: white;
                        padding: 30px 20px;
                        border-radius: 0 0 8px 8px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                    }
                    .button {
                        background-color: #d32f2f;
                        color: white;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                        margin: 20px 0;
                        font-weight: 600;
                        transition: background-color 0.3s;
                    }
                    .button:hover {
                        background-color: #c62828;
                    }
                    .footer {
                        color: #999;
                        font-size: 12px;
                        margin-top: 20px;
                        border-top: 1px solid #eee;
                        padding-top: 20px;
                    }
                    .footer a {
                        color: #d32f2f;
                        text-decoration: none;
                    }
                    .footer a:hover {
                        text-decoration: underline;
                    }
                    .expire-notice {
                        background-color: #fff3cd;
                        border: 1px solid #ffc107;
                        border-radius: 5px;
                        padding: 15px;
                        margin: 20px 0;
                        color: #856404;
                        font-size: 14px;
                    }
                    .link-text {
                        word-break: break-all;
                        color: #666;
                        font-size: 12px;
                        background-color: #f5f5f5;
                        padding: 10px;
                        border-radius: 4px;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 Car Mechanic</h1>
                        <p style="margin: 0; opacity: 0.9;">Verify Your Email</p>
                    </div>

                    <div class="content">
                        <h2>Welcome${name ? `, ${name}` : ''}!</h2>

                        <p>Thank you for signing up for Car Mechanic! We're excited to have you on board.</p>

                        <p>To get started with expert AI-powered automotive advice, please verify your email address by clicking the button below:</p>

                        <center>
                            <a href="${verificationLink}" class="button">Verify Email Address</a>
                        </center>

                        <p>Or copy and paste this link in your browser:</p>
                        <p class="link-text">${verificationLink}</p>

                        <div class="expire-notice">
                            <strong>⏰ Note:</strong> This verification link will expire in 24 hours. If you didn't create this account or need a new link, you can safely ignore this email or contact support.
                        </div>

                        <p>Once verified, you'll have immediate access to:</p>
                        <ul>
                            <li>Get instant automotive advice for your vehicle</li>
                            <li>Search real-world forum discussions</li>
                            <li>Track maintenance and repairs</li>
                            <li>Unlock all premium features with your subscription</li>
                        </ul>

                        <div class="footer">
                            <p>© 2025 Car Mechanic. All rights reserved.</p>
                            <p>
                                <a href="https://car-mechanic.co.uk/privacy">Privacy Policy</a> |
                                <a href="https://car-mechanic.co.uk/terms">Terms of Service</a> |
                                <a href="https://car-mechanic.co.uk/support">Support</a>
                            </p>
                            <p>Car Mechanic UK | contact@car-mechanic.co.uk</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Verify Your Email

Welcome${name ? `, ${name}` : ''}!

Thank you for signing up for Car Mechanic! Please verify your email address to complete your account setup.

Click the link below to verify your email:
${verificationLink}

This link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.

Best regards,
Car Mechanic Team
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`✅ Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending verification email:', error.message);
        if (error.response) {
            console.error('SendGrid response body:', error.response.body);
        }
        return false;
    }
}

/**
 * Send welcome email
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @returns {Promise<boolean>} Success status
 */
async function sendWelcomeEmail(email, name) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn(`📧 [DEV MODE] Welcome email not sent (SendGrid not configured for ${email})`);
        return false;
    }

    const msg = {
        to: email,
        from: {
            email: process.env.SENDGRID_FROM_EMAIL || 'noreply@car-mechanic.co.uk',
            name: process.env.SENDGRID_FROM_NAME || 'Car Mechanic'
        },
        subject: 'Welcome to Car Mechanic!',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #333;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f9f9f9;
                    }
                    .header {
                        background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
                        color: white;
                        padding: 30px 20px;
                        text-align: center;
                        border-radius: 8px 8px 0 0;
                    }
                    .content {
                        background-color: white;
                        padding: 30px 20px;
                        border-radius: 0 0 8px 8px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                    }
                    .button {
                        background-color: #d32f2f;
                        color: white;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                        margin: 20px 0;
                        font-weight: 600;
                        transition: background-color 0.3s;
                    }
                    .button:hover {
                        background-color: #c62828;
                    }
                    .feature-box {
                        background-color: #f5f5f5;
                        border-left: 4px solid #d32f2f;
                        padding: 15px;
                        margin: 15px 0;
                        border-radius: 4px;
                    }
                    .footer {
                        color: #999;
                        font-size: 12px;
                        margin-top: 20px;
                        border-top: 1px solid #eee;
                        padding-top: 20px;
                    }
                    .footer a {
                        color: #d32f2f;
                        text-decoration: none;
                    }
                    .footer a:hover {
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 Car Mechanic</h1>
                        <p style="margin: 0; opacity: 0.9;">Your AI-Powered Automotive Assistant</p>
                    </div>

                    <div class="content">
                        <h2>Welcome, ${name || 'Friend'}!</h2>

                        <p>Your Car Mechanic account is ready to go! 🎉</p>

                        <p>Get expert automotive advice powered by AI and real-world forum discussions. Whether you're diagnosing a problem or planning maintenance, we've got you covered.</p>

                        <center>
                            <a href="https://car-mechanic.co.uk/chat" class="button">Start Chatting Now</a>
                        </center>

                        <h3>What You Can Do Now:</h3>
                        <div class="feature-box">
                            <strong>💬 Ask AI Questions</strong><br>
                            Get instant answers about your vehicle's issues, maintenance, and repairs
                        </div>

                        <div class="feature-box">
                            <strong>🔍 Search Forums</strong><br>
                            Find real discussions from other mechanics and car owners with similar vehicles
                        </div>

                        <div class="feature-box">
                            <strong>📋 Track Maintenance</strong><br>
                            Keep records of your vehicle's service history and upcoming maintenance
                        </div>

                        <div class="feature-box">
                            <strong>🚀 Premium Features</strong><br>
                            Upgrade your subscription for unlimited access and advanced tools
                        </div>

                        <p style="margin-top: 30px;">
                            <strong>Need help?</strong> Check out our <a href="https://car-mechanic.co.uk/docs">documentation</a> or <a href="https://car-mechanic.co.uk/support">contact support</a>.
                        </p>

                        <div class="footer">
                            <p>© 2025 Car Mechanic. All rights reserved.</p>
                            <p>
                                <a href="https://car-mechanic.co.uk/privacy">Privacy Policy</a> |
                                <a href="https://car-mechanic.co.uk/terms">Terms of Service</a> |
                                <a href="https://car-mechanic.co.uk/support">Support</a>
                            </p>
                            <p>Car Mechanic UK | contact@car-mechanic.co.uk</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Welcome, ${name || 'Friend'}!

Your Car Mechanic account is ready to go!

Get expert automotive advice powered by AI. Visit our chat to get started:
https://car-mechanic.co.uk/chat

You can now:
- Get instant automotive advice for your vehicle
- Search real-world forum discussions
- Track maintenance and repairs
- Access premium features with your subscription

Need help? Visit https://car-mechanic.co.uk/support

Best regards,
Car Mechanic Team
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`✅ Welcome email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending welcome email:', error.message);
        if (error.response) {
            console.error('SendGrid response body:', error.response.body);
        }
        return false;
    }
}

/**
 * Send password reset email (future feature)
 * @param {string} email - User's email address
 * @param {string} resetLink - Full URL to password reset page
 * @param {string} name - User's name (optional)
 * @returns {Promise<boolean>} Success status
 */
async function sendPasswordResetEmail(email, resetLink, name = null) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn(`📧 [DEV MODE] Password reset link for ${email}: ${resetLink}`);
        return false;
    }

    const msg = {
        to: email,
        from: {
            email: process.env.SENDGRID_FROM_EMAIL || 'noreply@car-mechanic.co.uk',
            name: process.env.SENDGRID_FROM_NAME || 'Car Mechanic'
        },
        subject: 'Reset Your Car Mechanic Password',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #333;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f9f9f9;
                    }
                    .header {
                        background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
                        color: white;
                        padding: 30px 20px;
                        text-align: center;
                        border-radius: 8px 8px 0 0;
                    }
                    .content {
                        background-color: white;
                        padding: 30px 20px;
                        border-radius: 0 0 8px 8px;
                    }
                    .button {
                        background-color: #d32f2f;
                        color: white;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                        margin: 20px 0;
                        font-weight: 600;
                    }
                    .warning {
                        background-color: #ffebee;
                        border: 1px solid #f44336;
                        border-radius: 5px;
                        padding: 15px;
                        margin: 20px 0;
                        color: #c62828;
                    }
                    .footer {
                        color: #999;
                        font-size: 12px;
                        margin-top: 20px;
                        border-top: 1px solid #eee;
                        padding-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 Car Mechanic</h1>
                        <p style="margin: 0; opacity: 0.9;">Password Reset</p>
                    </div>

                    <div class="content">
                        <h2>Reset Your Password</h2>

                        <p>We received a request to reset your Car Mechanic password. Click the button below to create a new password:</p>

                        <center>
                            <a href="${resetLink}" class="button">Reset Password</a>
                        </center>

                        <div class="warning">
                            <strong>⚠️  Security Notice:</strong> If you didn't request this password reset, you can safely ignore this email. Your account remains secure.
                        </div>

                        <p><strong>This link expires in 1 hour.</strong> For your security, don't share this email or the reset link with anyone.</p>

                        <div class="footer">
                            <p>© 2025 Car Mechanic. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`✅ Password reset email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending password reset email:', error.message);
        return false;
    }
}

module.exports = {
    sendVerificationEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail
};
