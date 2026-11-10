# Volt & Valve — InfinityFree Deployment, Razorpay & SMS OTP Guide

## 1. InfinityFree Hosting Setup (PHP + MySQL)
1. **Build the Frontend**:
   - Run `npm run build` locally to generate the static `dist/` folder.
   - Upload the contents of `dist/` (`index.html`, `assets/`) into your InfinityFree `htdocs/` directory.
2. **Upload PHP Backend**:
   - Upload the `php-backend/` folder into `htdocs/php-backend/` (or `htdocs/api/` with `.htaccess` routing).
   - Create `htdocs/uploads/` with subdirectories `booking_photos/`, `provider_docs/`, and `completion_photos/` (permissions `0755`).
   - Protect `php-backend/config/config.php` using an `.htaccess` rule (`Deny from all` on `config/`).
3. **Import MySQL Database**:
   - In InfinityFree Control Panel → **MySQL Databases**, create a new database.
   - Open **phpMyAdmin**, select the database, and import `/database/schema.sql`.
   - Update `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS` inside `/php-backend/config/config.php`.
4. **Default Admin Credentials**:
   - Email: `admin@voltvalve.in`
   - Password: `Admin@123` (Change immediately in phpMyAdmin or Admin settings after first login).

## 2. Separate Role-Based Portal URLs
- **User Panel & Public Booking**: `https://yourdomain.com/`
- **Electrician / Plumber Portal**: `https://yourdomain.com/#/provider`
- **Admin Portal**: `https://yourdomain.com/#/admin`
- Normal users never see Electrician or Admin login links in the User UI, and every PHP API endpoint enforces `requireAuth([...])` on the server.

## 3. Razorpay Configuration
1. Log in to the **Razorpay Dashboard** → **Settings → API Keys** and generate your Key ID & Key Secret.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `/php-backend/config/config.php` (never expose `RAZORPAY_KEY_SECRET` in frontend code).
3. In `index.html`, the Razorpay Checkout script (`https://checkout.razorpay.com/v1/checkout.js`) is already included.
4. Payment flow:
   - Frontend requests `/php-backend/api/payment.php?action=create_order`
   - Razorpay Checkout opens for the customer
   - On completion, `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` are sent to `/php-backend/api/payment.php?action=verify_payment`
   - Server verifies HMAC-SHA256 signature before confirming the booking and generating the Booking ID.

## 4. Adding an SMS OTP API Later
1. Open `/php-backend/config/config.php` and set:
   - `SMS_GATEWAY_ENABLED` to `true`
   - `SMS_PROVIDER` (`msg91`, `fast2sms`, or `twilio`)
   - `SMS_API_KEY` and `SMS_SENDER_ID`
2. Open `/php-backend/helpers/otp.php` and implement `dispatchSmsGateway($mobile, $message)` using PHP `curl_init()` to call your chosen SMS provider's HTTP API.
3. Because `SMS_GATEWAY_ENABLED` controls whether `debug_otp` is returned, once enabled in production, OTPs are strictly delivered via SMS.
