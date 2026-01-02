-- Atomic job failure operation with retry logic
--
-- Atomically marks a job as failed and either:
-- - Re-enqueues it for retry (if retries < maxRetries)
-- - Moves it to failed set (if retries exhausted)
--
-- This ensures consistent state and proper retry handling even with concurrent operations.
--
-- KEYS[1] = sorted set key for running jobs (queue:{name}:running)
-- KEYS[2] = sorted set key for queued jobs (queue:{name}:queued)
-- KEYS[3] = sorted set key for failed jobs (queue:{name}:failed)
-- KEYS[4] = job hash key pattern (job:)
--
-- ARGV[1] = job ID
-- ARGV[2] = current timestamp
-- ARGV[3] = error message
--
-- Returns: 
--   'retry' if job was re-enqueued for retry
--   'failed' if job was moved to failed set
--   nil if job not found in running set

-- Check if job exists in running set
local inRunning = redis.call('ZSCORE', KEYS[1], ARGV[1])

if not inRunning then
  -- Job not in running set (already completed, failed, or never started)
  return nil
end

-- Get job data from hash
local jobKey = KEYS[4] .. ARGV[1]
local jobData = redis.call('HMGET', jobKey, 'retries', 'maxRetries', 'priority', 'queuedAt')

local retries = tonumber(jobData[1]) or 0
local maxRetries = tonumber(jobData[2]) or 3
local priority = tonumber(jobData[3]) or 5
local queuedAt = tonumber(jobData[4]) or tonumber(ARGV[2])

-- Increment retry count
local newRetries = retries + 1

-- Remove from running set
redis.call('ZREM', KEYS[1], ARGV[1])

-- Check if we should retry or mark as failed
if newRetries <= maxRetries then
  -- Re-enqueue for retry
  -- Calculate score: -priority + (timestamp / 1e13)
  local score = -priority + (queuedAt / 10000000000000)
  redis.call('ZADD', KEYS[2], score, ARGV[1])
  
  -- Update job hash for retry
  redis.call('HSET', jobKey,
    'status', 'queued',
    'retries', tostring(newRetries),
    'error', ARGV[3],
    'startedAt', '',  -- Clear startedAt for retry
    'progress', '0'   -- Reset progress
  )
  
  return 'retry'
else
  -- Retries exhausted, move to failed set
  redis.call('ZADD', KEYS[3], ARGV[2], ARGV[1])
  
  -- Update job hash as failed
  redis.call('HSET', jobKey,
    'status', 'failed',
    'failedAt', ARGV[2],
    'retries', tostring(newRetries),
    'error', ARGV[3]
  )
  
  return 'failed'
end