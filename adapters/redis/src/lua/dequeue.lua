-- Atomic dequeue operation
--
-- Atomically removes the highest priority job from the queue and updates its status.
-- This ensures that only one worker gets the job even with concurrent dequeuers.
--
-- KEYS[1] = sorted set key for queued jobs (queue:{name}:queued)
-- KEYS[2] = sorted set key for running jobs (queue:{name}:running)
-- KEYS[3] = job hash key pattern (job:)
--
-- ARGV[1] = current timestamp
--
-- Returns: job ID if dequeued, nil if queue is empty

-- Get the highest priority job (lowest score in sorted set)
local jobIds = redis.call('ZRANGE', KEYS[1], 0, 0)

if #jobIds == 0 then
  return nil  -- Queue is empty
end

local jobId = jobIds[1]

-- Remove from queued set
redis.call('ZREM', KEYS[1], jobId)

-- Add to running set with current timestamp as score
redis.call('ZADD', KEYS[2], ARGV[1], jobId)

-- Update job status and startedAt in hash
local jobKey = KEYS[3] .. jobId
redis.call('HSET', jobKey, 'status', 'running', 'startedAt', ARGV[1])

-- Return the job ID
return jobId