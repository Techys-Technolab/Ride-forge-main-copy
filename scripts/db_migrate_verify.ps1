param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$RedisUrl = $env:REDIS_URL,
  [string]$ApiUrl = "http://localhost:4000"
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  throw "DATABASE_URL is not set. Pass -DatabaseUrl or set env:DATABASE_URL."
}

Write-Host "Applying migration to existing DB..."
psql $DatabaseUrl -f "infra/sql/migrations/2026-02-21_existing_db_patch.sql"

Write-Host "`nVerifying required schema fields..."
psql $DatabaseUrl -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('ride_distance_total_km','ride_reward_km_remainder') ORDER BY column_name;"
psql $DatabaseUrl -c "SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name IN ('kind','description') ORDER BY column_name;"
psql $DatabaseUrl -c "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('subtotal_cents','shipping_fee_cents','shipping_option','shipping_address_line1','shipping_postal_code') ORDER BY column_name;"
psql $DatabaseUrl -c "SELECT to_regclass('public.user_device_tokens') AS user_device_tokens_table;"
psql $DatabaseUrl -c "SELECT NOW() AS db_time, COUNT(*) AS users_count FROM users;"

if ($RedisUrl) {
  Write-Host "`nChecking Redis..."
  try {
    redis-cli -u $RedisUrl PING
  } catch {
    Write-Warning "redis-cli unavailable or Redis unreachable. Check server logs for Redis status."
  }
}

Write-Host "`nChecking API health endpoint..."
try {
  $health = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing
  Write-Host $health.Content
} catch {
  Write-Warning "API health check failed. Ensure server is running at $ApiUrl."
}

Write-Host "`nDB migration + verification completed."
