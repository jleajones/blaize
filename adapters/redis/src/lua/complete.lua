-- Atomic job completion operation
--
-- Atomically marks a job as completed and moves it from running to completed set.
-- This ensures consistent state even with concurrent operations.
--
-- KEYS[1] = sorted set key for running jobs (queue:{name}:running)
-- KEYS[2] = sorted set key for completed jobs (queue:{name}:completed)
-- KEYS[3] = job hash key pattern (job:)
--
-- ARGV[1] = job ID
-- ARGV[2] = current timestamp
-- ARGV[3] = result (JSON string, optional)
--
-- Returns: 1 if successful, 0 if job not found in running set

-- Check if job exists in running set
local inRunning = redis.call('ZSCORE', KEYS[1], ARGV[1])

if not inRunning then
  -- Job not in running set (already completed, failed, or never started)
  return 0
end

-- Remove from running set
redis.call('ZREM', KEYS[1], ARGV[1])

-- Add to completed set with completion timestamp as score
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])

-- Update job hash
local jobKey = KEYS[3] .. ARGV[1]
redis.call('HSET', jobKey, 
  'status', 'completed',
  'completedAt', ARGV[2],
  'progress', '100'
)

-- Store result if provided
if ARGV[3] and ARGV[3] ~= '' then
  redis.call('HSET', jobKey, 'result', ARGV[3])
end

return 1