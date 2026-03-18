# Notification Event Coverage

## Auth

- `profile_created`: sent after rider/club profile is created.
- `profile_updated`: sent after successful profile update from detailed profile screen.
- `profile_update_failed`: sent when profile update operation fails server-side.
- `auth_account_verified`: sent when both email and phone verification are complete.
- `auth_login_success`: sent on successful login.
- `auth_password_changed`: sent after forgot-password reset confirmation.

## Chat + Safety

- `chat_message`: sent to conversation members on new message.
- `help_request_open`: sent to local riders for new help requests.
- `help_request_matched`: sent to requester when a rider responds.

## Ride & Rewards

- `ride_complete`: sent when a ride is stopped/saved.
- `challenge_complete`: sent when a challenge is completed.

## Ride & Events

- `event_published`: sent when creator publishes ride/event.
- `event_interest`: sent to host when user expresses interest.
- `event_contact`: sent to host when user contacts creator.

## Clubs

- `club_join_request`: sent to club owner on join request.
- `club_join_review`: sent to rider on approve/reject.
- `club_join_cancelled`: sent to club owner when rider cancels pending request.
- `club_member_removed`: sent to rider when removed.
- `profile_system_change`: sent to riders when club archive forces profile change (auto switched to solo rider).

## Store + Shipping

- `store_order` with status payload (`confirmed`, `packed`, `shipped`, `out_for_delivery`, `delivered`):
  - order confirmed
  - payment successful
  - admin status updates

## Reliability

- All feature routers use `sendPushToUsersSafe`, so main business actions continue even if FCM is temporarily unavailable.
- Invalid/unregistered tokens are automatically removed.
