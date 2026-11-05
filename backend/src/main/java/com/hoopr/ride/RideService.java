package com.hoopr.ride;

import com.hoopr.user.UserRepository;
import com.hoopr.user.ProfileRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.hoopr.ride.RideDtos.*;

@Service
public class RideService {
    private final RideRepository rides;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ProfileRepository profiles;
    private final com.hoopr.booking.BookingService bookings;
    public RideService(RideRepository rides, UserRepository users, JdbcTemplate jdbc, Clock clock, ProfileRepository profiles, com.hoopr.booking.BookingService bookings) {
        this.rides = rides; this.users = users; this.jdbc = jdbc; this.clock = clock; this.profiles = profiles;
        this.bookings = bookings;
    }
    @Transactional
    public View create(UUID driver, Create body) {
        active(driver);
        validateDeparture(body.departureAt(), body.timeZone());
        validateLocations(body.origin(), body.destination());
        // PostgreSQL upsert also serializes simultaneous first offers by the same driver.
        jdbc.update("INSERT INTO driver_profiles(user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING", driver);
        Ride ride = new Ride(); ride.id = UUID.randomUUID(); ride.driverId = driver;
        ride.driverProfile = profiles.findById(driver).orElse(null);
        ride.origin = body.origin().strip(); ride.destination = body.destination().strip();
        ride.originKey = locationKey(ride.origin); ride.destinationKey = locationKey(ride.destination);
        ride.pickupDescription = optional(body.pickupDescription()); ride.dropoffDescription = optional(body.dropoffDescription());
        ride.vehicleDetails = optional(body.vehicleDetails()); ride.notes = optional(body.notes());
        ride.departureAt = body.departureAt(); ride.timeZone = zone(body.timeZone()).getId();
        ride.totalSeats = body.totalSeats().shortValue(); ride.availableSeats = ride.totalSeats;
        ride.pricePerSeat = body.pricePerSeat(); ride.currency = body.currency(); ride.status = "SCHEDULED";
        ride.createdAt = ride.updatedAt = clock.instant();
        rides.saveAndFlush(ride);
        return view(ride);
    }
    @Transactional(readOnly = true)
    public Results search(String origin, String destination, LocalDate date, String timeZone,
            int minimumSeats, BigDecimal maximumPrice, int page, int size) {
        var filter = RideSpecifications.available(clock.instant(), origin, destination, date, zone(timeZone), minimumSeats, maximumPrice);
        return results(rides.findAll(filter, paging(page, size)));
    }
    @Transactional(readOnly = true)
    public Results mine(UUID user, int page, int size) {
        active(user);
        return results(rides.findAll((root, query, cb) -> cb.equal(root.get("driverId"), user), paging(page, size)));
    }
    @Transactional(readOnly = true)
    public View details(UUID id, UUID viewer) {
        Ride ride = find(id);
        if (List.of("DRAFT", "IN_PROGRESS").contains(ride.status) && !ride.driverId.equals(viewer))
            throw new RideFailure(404, "Ride not found.");
        return view(ride);
    }
    @Transactional
    public View update(UUID id, UUID owner, Update body) {
        active(owner);
        Ride ride = editable(id, owner, body.version());
        Long reserved = jdbc.queryForObject("SELECT count(*) FROM bookings WHERE ride_id = ? AND status = 'CONFIRMED'", Long.class, id);
        if (ride.availableSeats != ride.totalSeats || (reserved != null && reserved > 0))
            throw new RideFailure(409, "Cancel active bookings before editing this ride.");
        if (body.origin() != null) { ride.origin = body.origin().strip(); ride.originKey = locationKey(ride.origin); }
        if (body.destination() != null) { ride.destination = body.destination().strip(); ride.destinationKey = locationKey(ride.destination); }
        validateLocations(ride.origin, ride.destination);
        if (body.departureAt() != null) ride.departureAt = body.departureAt();
        if (body.timeZone() != null) ride.timeZone = zone(body.timeZone()).getId();
        validateDeparture(ride.departureAt, ride.timeZone);
        if (body.totalSeats() != null) {
            if (ride.vehicleId != null) {
                Integer capacity = jdbc.queryForObject("SELECT passenger_capacity FROM vehicles WHERE id = ? AND driver_id = ?", Integer.class, ride.vehicleId, owner);
                if (capacity == null || body.totalSeats() > capacity) throw new RideFailure(400, "Seats exceed the linked vehicle capacity.");
            }
            ride.totalSeats = body.totalSeats().shortValue(); ride.availableSeats = ride.totalSeats;
        }
        if (body.pricePerSeat() != null) ride.pricePerSeat = body.pricePerSeat();
        if (body.currency() != null) ride.currency = body.currency();
        if (body.pickupDescription() != null) ride.pickupDescription = optional(body.pickupDescription());
        if (body.dropoffDescription() != null) ride.dropoffDescription = optional(body.dropoffDescription());
        if (body.vehicleDetails() != null) ride.vehicleDetails = optional(body.vehicleDetails());
        if (body.notes() != null) ride.notes = optional(body.notes());
        ride.updatedAt = clock.instant(); rides.flush();
        return view(ride);
    }
    @Transactional
    public View cancel(UUID id, UUID owner, Cancel body) {
        active(owner);
        Ride ride = editable(id, owner, body.version());
        bookings.cancelForDriver(ride, owner, body.reason());
        ride.status = "CANCELLED"; ride.cancellationReason = optional(body.reason());
        ride.cancelledAt = ride.updatedAt = clock.instant(); rides.flush();
        return view(ride);
    }
    @Transactional
    public View start(UUID id, UUID owner, long version) {
        active(owner);
        Ride ride = lockOwned(id, owner, version);
        Instant now = clock.instant();
        if (!canStart(ride, now))
            throw new RideFailure(409, "A scheduled ride can start at or after departure.");
        ride.status = "IN_PROGRESS";
        ride.startedAt = ride.updatedAt = now;
        rides.flush();
        return view(ride);
    }

    @Transactional
    public View complete(UUID id, UUID owner, long version) {
        active(owner);
        Ride ride = lockOwned(id, owner, version);
        if (!"IN_PROGRESS".equals(ride.status))
            throw new RideFailure(409, "Only a ride in progress can be completed.");
        Instant now = clock.instant();
        if (ride.startedAt != null && now.isBefore(ride.startedAt))
            throw new RideFailure(409, "Completion cannot precede the ride start.");
        ride.status = "COMPLETED";
        ride.completedAt = ride.updatedAt = now;
        rides.flush();
        return view(ride);
    }

    private static boolean canStart(Ride ride, Instant now) {
        return List.of("SCHEDULED", "PUBLISHED").contains(ride.status) && !ride.departureAt.isAfter(now);
    }

    private Ride lockOwned(UUID id, UUID owner, long version) {
        Ride ride = rides.lockById(id).orElseThrow(() -> new RideFailure(404, "Ride not found."));
        if (!ride.driverId.equals(owner)) throw new RideFailure(403, "Only the ride owner can manage this ride.");
        if (ride.version != version) throw new RideFailure(409, "Ride changed. Reload before trying again.");
        return ride;
    }
    private Ride editable(UUID id, UUID owner, long version) {
        Ride ride = lockOwned(id, owner, version);
        if (!List.of("SCHEDULED", "PUBLISHED").contains(ride.status) || !ride.departureAt.isAfter(clock.instant()))
            throw new RideFailure(409, "Only future scheduled rides can be changed.");
        return ride;
    }
    private void active(UUID user) {
        if (users.findById(user).filter(u -> "ACTIVE".equals(u.status)).isEmpty())
            throw new RideFailure(401, "Account is unavailable. Please log in.");
    }
    private Ride find(UUID id) { return rides.findById(id).orElseThrow(() -> new RideFailure(404, "Ride not found.")); }
    private void validateDeparture(Instant departure, String timeZone) {
        zone(timeZone);
        if (departure == null || !departure.isAfter(clock.instant())) throw new RideFailure(400, "Departure must be in the future.");
    }
    public static ZoneId zone(String value) {
        try { return ZoneId.of(value); }
        catch (RuntimeException e) { throw new RideFailure(400, "Use a valid IANA time zone, for example Asia/Kolkata."); }
    }
    private static void validateLocations(String origin, String destination) {
        if (origin == null || destination == null || origin.isBlank() || destination.isBlank())
            throw new RideFailure(400, "Origin and destination are required.");
        if (origin.strip().equalsIgnoreCase(destination.strip())) throw new RideFailure(400, "Origin and destination must differ.");
    }
    private static String locationKey(String location) {
        // Stable keys fit Phase 1's locality columns without a maps/geocoding dependency.
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(location.strip().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
    private static String optional(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static Pageable paging(int page, int size) { return PageRequest.of(page, size, Sort.by("departureAt").ascending().and(Sort.by("id"))); }
    private Results results(Page<Ride> page) {
        return new Results(page.getContent().stream().map(this::view).toList(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
    private View view(Ride ride) {
        // Repository entity graphs fetch the safe driver profile in the page query.
        String name = ride.driverProfile == null ? "Hoopr driver" : ride.driverProfile.getFullName();
        if (name == null || name.isBlank()) name = "Hoopr driver";
        else name = name.strip().split("\\s+", 2)[0];
        return new View(ride.id, new Driver(ride.driverId, name), ride.origin, ride.destination,
                ride.pickupDescription, ride.dropoffDescription, ride.departureAt, ride.timeZone,
                ride.totalSeats, ride.availableSeats, ride.pricePerSeat, ride.currency, ride.vehicleDetails,
                ride.notes, "PUBLISHED".equals(ride.status) ? "SCHEDULED" : ride.status, ride.version,
                ride.createdAt, ride.updatedAt, ride.cancelledAt, ride.cancellationReason,
                ride.startedAt, ride.completedAt, canStart(ride, clock.instant()));
    }
}
