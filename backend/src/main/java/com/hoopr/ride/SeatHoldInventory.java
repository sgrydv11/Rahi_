package com.hoopr.ride;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/** Read-only mapping for the inventory subquery shared by search and pagination counts. */
@Entity @Immutable @Table(name = "group_seat_holds")
public class SeatHoldInventory {
    @Id public UUID id;
    @Column(name = "ride_id", nullable = false) public UUID rideId;
    @Column(nullable = false) public short seats;
    @Column(name = "expires_at", nullable = false) public Instant expiresAt;
    @Column(nullable = false, length = 20) public String status;
}
