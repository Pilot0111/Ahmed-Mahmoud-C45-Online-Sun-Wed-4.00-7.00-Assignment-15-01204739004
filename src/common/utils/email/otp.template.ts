export const otpTemplate = ({ userName = 'User', otp, subject = 'Verification Code' }: { userName?: string, otp: string, subject?: string }) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            .container {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #e0e0e0;
                border-radius: 10px;
                background-color: #f9f9f9;
            }
            .header {
                text-align: center;
                padding-bottom: 20px;
            }
            .header h1 {
                color: #333;
                margin: 0;
            }
            .content {
                background-color: #ffffff;
                padding: 30px;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .otp-code {
                font-size: 32px;
                font-weight: bold;
                color: #007bff;
                letter-spacing: 5px;
                margin: 20px 0;
                padding: 10px;
                border: 2px dashed #007bff;
                display: inline-block;
            }
            .footer {
                text-align: center;
                padding-top: 20px;
                font-size: 12px;
                color: #777;
            }
            .footer p {
                margin: 5px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Saraha App</h1>
            </div>
            <div class="content">
                <p>Hello <strong>${userName}</strong>,</p>
                <p>You requested a code for <strong>${subject}</strong>. Please use the following One-Time Password (OTP):</p>
                <div class="otp-code">${otp}</div>
                <p>This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Saraha App. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};