package com.hoopr.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id public UUID id;
    @Column(nullable = false, length = 254) public String email;
    @Column(name = "password_hash", nullable = false) public String passwordHash;
    @Column(name = "google_subject", length = 255) public String googleSubject;
    @Column(name = "mobile_number", length = 16) public String mobileNumber;
    @Column(name = "mobile_verified", nullable = false) public boolean mobileVerified;
    @Column(name = "failed_login_count", nullable = false) public int failedLoginCount;
    @Column(name = "login_window_start") public Instant loginWindowStart;
    @Column(name = "login_locked_until") public Instant loginLockedUntil;
    @Column(nullable = false, length = 20) public String status;
    @Column(nullable = false, length = 10) public String role;
    @Column(name = "created_at", nullable = false) public Instant createdAt;
    @Column(name = "updated_at", nullable = false) public Instant updatedAt;
}
