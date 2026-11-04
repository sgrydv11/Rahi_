package com.hoopr.auth;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name = "refresh_sessions")
public class RefreshSession {
    @Id public UUID id;
    @Column(name = "user_id", nullable = false) public UUID userId;
    @Column(name = "expires_at", nullable = false) public Instant expiresAt;
    @Column(nullable = false) public boolean revoked;
}
