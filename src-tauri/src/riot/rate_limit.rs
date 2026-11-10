//! Client-side rate limiting for the Riot API.
//!
//! Riot applies limits per routing value (platform or regional cluster).
//! Development keys allow 20 requests/1 s and 100 requests/2 min; the app
//! stays slightly below. A 429 response additionally blocks the routing value
//! until its `Retry-After`. Time is passed in, so the logic is deterministic.

use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

pub struct RateLimiter {
    /// (max requests, window length)
    windows: Vec<(usize, Duration)>,
    history: HashMap<String, VecDeque<Instant>>,
    blocked_until: HashMap<String, Instant>,
}

impl RateLimiter {
    pub fn new(windows: Vec<(usize, Duration)>) -> Self {
        Self {
            windows,
            history: HashMap::new(),
            blocked_until: HashMap::new(),
        }
    }

    /// Development-key limits with a small safety margin.
    pub fn development() -> Self {
        Self::new(vec![
            (18, Duration::from_secs(1)),
            (95, Duration::from_secs(120)),
        ])
    }

    /// Reserves one request slot for `key`, or returns how long to wait.
    pub fn acquire(&mut self, key: &str, now: Instant) -> Result<(), Duration> {
        if let Some(until) = self.blocked_until.get(key) {
            if *until > now {
                return Err(*until - now);
            }
            self.blocked_until.remove(key);
        }

        let longest = self
            .windows
            .iter()
            .map(|(_, window)| *window)
            .max()
            .unwrap_or_default();
        let history = self.history.entry(key.to_string()).or_default();
        while history
            .front()
            .is_some_and(|sent| now.duration_since(*sent) >= longest)
        {
            history.pop_front();
        }

        for (limit, window) in &self.windows {
            let in_window: Vec<&Instant> = history
                .iter()
                .filter(|sent| now.duration_since(**sent) < *window)
                .collect();
            if in_window.len() >= *limit {
                let oldest = in_window[0];
                return Err(*window - now.duration_since(*oldest));
            }
        }

        history.push_back(now);
        Ok(())
    }

    /// Blocks `key` after a 429 until `now + retry_after`.
    pub fn block(&mut self, key: &str, now: Instant, retry_after: Duration) {
        self.blocked_until
            .insert(key.to_string(), now + retry_after);
    }
}
