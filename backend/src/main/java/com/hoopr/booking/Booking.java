package com.hoopr.booking;

import com.hoopr.ride.Ride;
import com.hoopr.user.UserProfile;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "bookings")
public class Booking {
    @Id public UUID id;
    @Column(name = "ride_id", nullable = false, updatable = false) public UUID rideId;
    @Column(name = "passenger_id", nullable = false, updatable = false) public UUID passengerId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ride_id", insertable = false, updatable = false) public Ride ride;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "passenger_id", referencedColumnName = "user_id", insertable = false, updatable = false) public UserProfile passengerProfile;
    @Column(name = "seats_booked", nullable = false) public short seatsBooked;
    @Column(name = "paid_fare_paise") public Long paidFarePaise;
    @Column(name = "price_per_seat_snapshot", nullable = false, precision = 12, scale = 2) public BigDecimal pricePerSeatSnapshot;
    @Column(nullable = false, length = 3) public String currency;
    @Column(nullable = false, length = 30) public String status;
    @Column(name = "idempotency_key", updatable = false) public UUID idempotencyKey;
    @Version public long version;
    @Column(name = "cancelled_by") public UUID cancelledBy;
    @Column(name = "cancellation_reason", length = 500) public String cancellationReason;
    @Column(name = "cancelled_at") public Instant cancelledAt;
    @Column(name = "driver_rating") public Integer driverRating;
    @Column(name = "rated_at") public Instant ratedAt;
    @Column(name = "created_at", nullable = false) public Instant createdAt;
    @Column(name = "updated_at", nullable = false) public Instant updatedAt;
}
