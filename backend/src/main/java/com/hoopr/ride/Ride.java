package com.hoopr.ride;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import com.hoopr.user.UserProfile;

@Entity @Table(name = "rides")
public class Ride {
    public UUID getId() { return id; }
    public UUID getDriverId() { return driverId; }
    public String getOrigin() { return origin; }
    public String getDestination() { return destination; }
    public Instant getDepartureAt() { return departureAt; }
    public String getTimeZone() { return timeZone; }
    public String getStatus() { return status; }
    @Id public UUID id;
    @Column(name = "driver_id", nullable = false) public UUID driverId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id", referencedColumnName = "user_id", insertable = false, updatable = false)
    public UserProfile driverProfile;
    @Column(name = "vehicle_id") public UUID vehicleId;
    @Column(name = "source_name", nullable = false, length = 200) public String origin;
    @Column(name = "source_locality_id", nullable = false, length = 120) public String originKey;
    @Column(name = "destination_name", nullable = false, length = 200) public String destination;
    @Column(name = "destination_locality_id", nullable = false, length = 120) public String destinationKey;
    @Column(name = "pickup_description", length = 500) public String pickupDescription;
    @Column(name = "dropoff_description", length = 500) public String dropoffDescription;
    @Column(name = "vehicle_details", length = 300) public String vehicleDetails;
    @Column(length = 2000) public String notes;
    @Column(name = "departure_at", nullable = false) public Instant departureAt;
    @Column(name = "departure_time_zone", nullable = false, length = 64) public String timeZone;
    @Column(name = "total_seats", nullable = false) public short totalSeats;
    @Column(name = "available_seats", nullable = false) public short availableSeats;
    @Column(name = "price_per_seat", nullable = false, precision = 12, scale = 2) public BigDecimal pricePerSeat;
    @Column(nullable = false, length = 3) public String currency;
    @Column(nullable = false, length = 20) public String status;
    @Version @Column(nullable = false) public long version;
    @Column(name = "cancellation_reason", length = 500) public String cancellationReason;
    @Column(name = "cancelled_at") public Instant cancelledAt;
    @Column(name = "created_at", nullable = false) public Instant createdAt;
    @Column(name = "updated_at", nullable = false) public Instant updatedAt;
}
