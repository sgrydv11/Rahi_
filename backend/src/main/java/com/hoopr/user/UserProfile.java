package com.hoopr.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_profiles")
public class UserProfile {
    public String getFullName() { return fullName; }
    @Id @Column(name = "user_id") public UUID userId;
    @Column(name = "full_name", nullable = false, length = 120) public String fullName;
    @Enumerated(EnumType.STRING)
    @Column(name = "travel_preference", nullable = false, length = 10)
    public TravelPreference travelPreference = TravelPreference.BOTH;
    @Column(name = "created_at", nullable = false) public Instant createdAt;
    @Column(name = "updated_at", nullable = false) public Instant updatedAt;
}
