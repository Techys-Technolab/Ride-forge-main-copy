# Firebase Setup (Server + Mobile Push)

## 1) Create Firebase project

1. Open Firebase Console and create/select your project.
2. Enable Cloud Messaging.
3. Create a service account key from Project Settings -> Service Accounts -> Generate new private key.

## 2) Configure backend env

You can configure Firebase in either of these safe ways.

### Option A: Individual env values

Set these values in `apps/server/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Option B: Whole service-account JSON

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id",...}
```

### Option C: Local file path for development

```env
FIREBASE_SERVICE_ACCOUNT_PATH=C:\\path\\to\\service-account.json
```

Notes:
- Keep surrounding quotes on `FIREBASE_PRIVATE_KEY`.
- Keep `\n` escaped in env values.
- Do not commit the Firebase JSON file into source control.
- For the attached Rideforge key file, use it via `FIREBASE_SERVICE_ACCOUNT_PATH` locally or convert it to `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel project secrets.

## 3) Apply DB schema changes

`user_device_tokens` table is required for push token storage. Re-apply `infra/sql/schema.sql` on new environments or create an equivalent migration on existing environments.

## 4) Mobile setup for FCM

1. Add Android app in Firebase and download `google-services.json`.
2. Place file at `apps/mobile/google-services.json`.
3. Build with EAS/Dev Client so FCM native config is included.

The app auto-registers a device token after login and sends it to:
- `POST /api/notifications/device-token`

## 5) Validate

1. Login on a physical device.
2. Call:

```http
POST /api/notifications/test
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "title": "Rideforge test",
  "body": "Push pipeline is active"
}
```

3. Verify push is received on device.
