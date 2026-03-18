# Ready-to-Paste Vercel Env Block

Use this block in the Vercel dashboard for the `apps/server` project.

Important:
- This is based on the current local `.env`.
- Replace placeholder values before production deployment.
- Do not use `FIREBASE_SERVICE_ACCOUNT_PATH` on Vercel.
- On Vercel, use `FIREBASE_SERVICE_ACCOUNT_JSON`.

```env
PORT=4000
JWT_SECRET=change-me-in-production
CORS_ORIGIN=https://your-frontend-domain.com
DATABASE_URL=postgres://postgres:postgres@your-db-host:5432/rideforge
REDIS_URL=redis://your-redis-host:6379
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
REVENUECAT_API_KEY=
CHECKOUT_SUCCESS_URL=https://your-domain.com/payment/success
CHECKOUT_CANCEL_URL=https://your-domain.com/payment/cancel
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=
OTP_PROVIDER_MODE=live
OTP_EXPOSE_DEV_CODES=false
OTP_REQUIRE_LIVE_PROVIDERS=true
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"ride-forge-app","private_key_id":"replace-me","private_key":"-----BEGIN PRIVATE KEY-----\nreplace-me\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-fbsvc@ride-forge-app.iam.gserviceaccount.com","client_id":"replace-me","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ride-forge-app.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

## Notes

- The local file path in `.env`:
  - `FIREBASE_SERVICE_ACCOUNT_PATH=C:\Users\ADMIN\Downloads\Bike riding app\ride-forge-app-firebase-adminsdk-fbsvc-e6cd048184 private key.json`
  - is valid only for local/server hosts you control.
- For Vercel, paste the full JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`.
