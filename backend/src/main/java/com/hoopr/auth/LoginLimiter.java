package com.hoopr.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Bounded per-process fixed windows. Uses socket IP, never untrusted forwarded headers. */
@Component
public class LoginLimiter {
    private record Window(Instant start, int count) { }
    private final Map<String, Window> windows = new HashMap<>();
    private final Clock clock;
    public LoginLimiter(Clock clock) { this.clock = clock; }
    // Reserve an attempt before hashing; only failed or in-flight attempts consume the budget.
    public synchronized void succeeded(String address) {
        Window window = windows.get(address);
        if (window == null) return;
        if (window.count <= 1) windows.remove(address);
        else windows.put(address, new Window(window.start, window.count - 1));
    }
    public synchronized void check(String address) {
        Instant now = clock.instant();
        windows.entrySet().removeIf(e -> e.getValue().start.plus(Duration.ofMinutes(15)).isBefore(now));
        Window old = windows.get(address);
        if ((old == null && windows.size() >= 10000) || (old != null && old.count >= 20))
            throw new AuthFailure(429, "Too many login attempts. Try again later.");
        windows.put(address, new Window(old == null ? now : old.start, old == null ? 1 : old.count + 1));
    }
}
