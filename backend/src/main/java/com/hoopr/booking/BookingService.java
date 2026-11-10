package com.hoopr.booking;

import com.hoopr.ride.*;
import com.hoopr.wallet.WalletRidePayments;
import com.hoopr.user.*;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.hoopr.booking.BookingDtos.*;

@Service
public class BookingService {
    private final BookingRepository bookings;
    private final RideRepository rides;
    private final UserRepository users;
    private final ProfileRepository profiles;
    private final Clock clock;
    private final GroupSeatInventory groupSeats;
    private final WalletRidePayments wallet;
    public BookingService(BookingRepository bookings, RideRepository rides, UserRepository users, ProfileRepository profiles, Clock clock, GroupSeatInventory groupSeats, WalletRidePayments wallet) {
        this.bookings = bookings; this.rides = rides; this.users = users; this.profiles = profiles; this.clock = clock; this.groupSeats = groupSeats; this.wallet = wallet;
    }
    @Transactional
    public Created create(UUID rideId, UUID passenger, UUID requestKey, int seats) {
        return create(rideId, passenger, requestKey, seats, null);
    }
    @Transactional
    public Created create(UUID rideId, UUID passenger, UUID requestKey, int seats, Long expectedVersion) {
        return create(rideId, passenger, requestKey, seats, expectedVersion, null);
    }
    @Transactional
    public Created create(UUID rideId, UUID passenger, UUID requestKey, int seats, Long expectedVersion, JourneyDetails details) {
        active(passenger);
        Ride ride = lockRide(rideId);
        var replay = bookings.findByPassengerIdAndIdempotencyKey(passenger, requestKey);
        if (replay.isPresent()) {
            Booking previous = replay.get();
            if (!previous.rideId.equals(rideId) || previous.seatsBooked != seats || !Objects.equals(previous.journeyDetails, details))
                throw new BookingFailure(409, "Idempotency key was already used for a different booking request.");
            return new Created(view(previous), true);
        }
        if (expectedVersion != null && ride.version != expectedVersion)
            throw new BookingFailure(409, "Ride changed. Reload it and review the current price and availability before booking.");
        if (ride.driverId.equals(passenger)) throw new BookingFailure(400, "You cannot book your own ride.");
        futureScheduled(ride);
        requireConsistentSeats(ride);
        if (seats < 1 || seats > 6 || seats > ride.totalSeats) throw new BookingFailure(400, "Choose a valid number of seats for this ride.");
        if (ride.preferences != null && details == null) throw new BookingFailure(400, "Select boarding, dropping and passenger details.");
        if (details != null) {
            var preferences = RidePreferences.forRide(ride);
            if (!preferences.boardingPoints().contains(details.boardingPoint()) || !preferences.droppingPoints().contains(details.droppingPoint()))
                throw new BookingFailure(400, "Select boarding and dropping points offered by the driver.");
            if (details.passengers().size() != seats) throw new BookingFailure(400, "Provide details for each passenger seat.");
            if (preferences.womenOnly() && details.passengers().stream().anyMatch(person -> person.gender() != Gender.FEMALE))
                throw new BookingFailure(400, "This ride is for women passengers only.");
        }
        if (bookings.existsByRideIdAndPassengerIdAndStatus(rideId, passenger, "CONFIRMED"))
            throw new BookingFailure(409, "You already have an active booking on this ride. View My Bookings.");
        Instant now = clock.instant();
        if (bookings.existsByRideIdAndPassengerIdAndStatusAndRequestExpiresAtAfter(rideId, passenger, "PENDING", now))
            throw new BookingFailure(409, "You already have a pending request for this ride. View My Bookings.");
        if (groupSeats.hasHold(rideId, passenger, clock.instant().atOffset(ZoneOffset.UTC)))
            throw new BookingFailure(409, "Cancel your active seat hold before booking this ride.");
        if (ride.availableSeats - groupSeats.heldSeats(rideId, clock.instant()) < seats) throw new BookingFailure(409, "Not enough seats remain. Reload the ride and try again.");
        Booking booking = new Booking(); booking.id = UUID.randomUUID(); booking.rideId = rideId;
        booking.ride = ride; booking.passengerId = passenger; booking.passengerProfile = profiles.findById(passenger).orElse(null);
        booking.seatsBooked = (short) seats; booking.pricePerSeatSnapshot = ride.pricePerSeat;
        booking.journeyDetails = details;
        booking.currency = ride.currency; booking.status = "CONFIRMED"; booking.idempotencyKey = requestKey;
        booking.createdAt = booking.updatedAt = now;
        if (RidePreferences.forRide(ride).requiresApproval()) {
            booking.status = "PENDING";
            Instant limit = now.plus(Duration.ofHours(24));
            booking.requestExpiresAt = ride.departureAt.isBefore(limit) ? ride.departureAt : limit;
        } else {
            ride.availableSeats -= (short) seats; ride.updatedAt = now;
        }
        Booking saved = bookings.saveAndFlush(booking); // Flushes both rows, including ride @Version.
        return new Created(view(saved), false);
    }
    @Transactional
    public View decide(UUID id, UUID owner, boolean accept) {
        active(owner);
        Ride ride = lockRide(bookings.rideIdFor(id).orElseThrow(() -> new BookingFailure(404, "Booking not found.")));
        if (!ride.driverId.equals(owner)) throw new BookingFailure(403, "Only the ride owner can review requests.");
        Booking booking = find(id);
        String decision = accept ? "CONFIRMED" : "DECLINED";
        if (booking.requestExpiresAt != null && decision.equals(booking.status)) return view(booking);
        if (!"PENDING".equals(effectiveStatus(booking))) throw new BookingFailure(409, "This booking request is no longer pending.");
        if (accept) {
            futureScheduled(ride);
            requireConsistentSeats(ride);
            if (users.findById(booking.passengerId).filter(u -> "ACTIVE".equals(u.status)).isEmpty())
                throw new BookingFailure(409, "The passenger account is unavailable.");
            if (ride.availableSeats - groupSeats.heldSeats(ride.id, clock.instant()) < booking.seatsBooked)
                throw new BookingFailure(409, "Not enough seats remain to accept this request.");
            ride.availableSeats -= booking.seatsBooked;
            ride.updatedAt = clock.instant();
        }
        booking.status = decision;
        booking.updatedAt = clock.instant();
        bookings.flush();
        return view(booking);
    }
    public void requireNoPendingRequests(UUID rideId) {
        if (bookings.existsByRideIdAndStatusAndRequestExpiresAtAfter(rideId, "PENDING", clock.instant()))
            throw new BookingFailure(409, "Review pending requests before editing this ride.");
    }
    @Transactional(readOnly = true)
    public Results mine(UUID passenger, int page, int size) {
        active(passenger); return results(bookings.findByPassengerId(passenger, paging(page, size)));
    }
    @Transactional(readOnly = true)
    public View details(UUID id, UUID viewer) {
        active(viewer); Booking booking = find(id);
        if (!booking.passengerId.equals(viewer) && !booking.ride.getDriverId().equals(viewer))
            throw new BookingFailure(403, "This booking is available only to its passenger or ride owner.");
        return view(booking);
    }
    @Transactional(readOnly = true)
    public Results manifest(UUID rideId, UUID owner, int page, int size) {
        active(owner);
        Ride ride = rides.findById(rideId).orElseThrow(() -> new BookingFailure(404, "Ride not found."));
        if (!ride.driverId.equals(owner)) throw new BookingFailure(403, "Only the ride owner can view its bookings.");
        return results(bookings.findByRideId(rideId, paging(page, size)));
    }
    @Transactional
    public View rate(UUID id, UUID passenger, int score) {
        return rate(id, passenger, score, null);
    }
    @Transactional
    public View rate(UUID id, UUID passenger, int score, String review) {
        review = optional(review);
        if (review != null && review.length() > 1000) throw new BookingFailure(400, "Review must be at most 1000 characters.");
        active(passenger);
        UUID rideId = bookings.rideIdFor(id).orElseThrow(() -> new BookingFailure(404, "Booking not found."));
        Ride ride = lockRide(rideId);
        Booking booking = find(id);
        if (!booking.passengerId.equals(passenger) || ride.driverId.equals(passenger))
            throw new BookingFailure(403, "Only the booked passenger can rate this ride.");
        if (!"CONFIRMED".equals(booking.status) || !"COMPLETED".equals(ride.status))
            throw new BookingFailure(409, "Only confirmed bookings on completed rides can be rated.");
        if (score < 1 || score > 5)
            throw new BookingFailure(400, "Choose a score from 1 to 5.");
        if (booking.driverRating != null) {
            if (booking.driverRating == score && Objects.equals(booking.reviewText, review)) return view(booking);
            throw new BookingFailure(409, "A rating has already been submitted for this booking.");
        }
        booking.driverRating = score;
        booking.reviewText = review;
        booking.ratedAt = booking.updatedAt = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        bookings.flush();
        return view(booking);
    }
    @Transactional
    public View cancel(UUID id, UUID passenger, String reason) {
        active(passenger);
        // Scalar lookup does not cache a Booking before its ride lock is acquired.
        UUID rideId = bookings.rideIdFor(id).orElseThrow(() -> new BookingFailure(404, "Booking not found."));
        Ride ride = lockRide(rideId);
        Booking booking = find(id);
        if (!booking.passengerId.equals(passenger)) throw new BookingFailure(403, "Only the passenger can cancel this booking.");
        if ("PENDING".equals(effectiveStatus(booking))) {
            cancelRecord(booking, "CANCELLED_BY_PASSENGER", passenger, reason);
            bookings.flush();
            return view(booking);
        }
        if (!"CONFIRMED".equals(booking.status)) return view(booking); // Never restores seats twice.
        futureScheduled(ride); requireConsistentSeats(ride);
        cancelRecord(booking, "CANCELLED_BY_PASSENGER", passenger, reason);
        ride.availableSeats += booking.seatsBooked; ride.updatedAt = clock.instant(); rides.flush();
        return view(booking);
    }
    /** Caller holds the ride lock and has already checked owner, lifecycle and client version. */
    @Transactional
    public void cancelForDriver(Ride ride, UUID owner, String reason) {
        requireConsistentSeats(ride);
        for (Booking booking : bookings.findByRideIdAndStatusOrderById(ride.id, "CONFIRMED").stream()
                .sorted(Comparator.comparing(b -> b.passengerId)).toList())
            cancelRecord(booking, "CANCELLED_BY_DRIVER", owner, reason);
        for (Booking booking : bookings.findByRideIdAndStatusOrderById(ride.id, "PENDING")) {
            if ("PENDING".equals(effectiveStatus(booking))) cancelRecord(booking, "CANCELLED_BY_DRIVER", owner, reason);
        }
        groupSeats.cancelForRide(ride.id);
        ride.availableSeats = ride.totalSeats;
    }
    public void requireConsistentSeats(Ride ride) {
        long reserved = bookings.confirmedSeats(ride.id);
        if (reserved + ride.availableSeats != ride.totalSeats)
            throw new BookingFailure(409, "Ride availability needs review before it can be changed.");
    }
    private void cancelRecord(Booking booking, String status, UUID actor, String reason) {
        wallet.refund(booking.id);
        booking.status = status; booking.cancelledBy = actor; booking.cancellationReason = optional(reason);
        booking.cancelledAt = booking.updatedAt = clock.instant();
    }
    private Ride lockRide(UUID id) { return rides.lockById(id).orElseThrow(() -> new BookingFailure(404, "Ride not found.")); }
    private Booking find(UUID id) { return bookings.findById(id).orElseThrow(() -> new BookingFailure(404, "Booking not found.")); }
    private void active(UUID user) {
        if (users.findById(user).filter(u -> "ACTIVE".equals(u.status)).isEmpty())
            throw new BookingFailure(401, "Account is unavailable. Please log in.");
    }
    private void futureScheduled(Ride ride) {
        if (!List.of("SCHEDULED", "PUBLISHED").contains(ride.status) || !ride.departureAt.isAfter(clock.instant()))
            throw new BookingFailure(409, "Bookings can only change on future scheduled rides.");
    }
    private View view(Booking booking) {
        Ride ride = booking.ride;
        String name = booking.passengerProfile == null ? "Hoopr passenger" : booking.passengerProfile.getFullName();
        if (name == null || name.isBlank()) name = "Hoopr passenger"; else name = name.strip().split("\\s+", 2)[0];
        var journey = new Journey(ride.getId(), ride.getDriverId(), ride.getOrigin(), ride.getDestination(), ride.getDepartureAt(),
                ride.getTimeZone(), "PUBLISHED".equals(ride.getStatus()) ? "SCHEDULED" : ride.getStatus(), RideDtos.routePins(ride));
        String status = effectiveStatus(booking);
        boolean canCancel = List.of("CONFIRMED", "PENDING").contains(status) && List.of("SCHEDULED", "PUBLISHED").contains(ride.getStatus())
                && ride.getDepartureAt().isAfter(clock.instant());
        Rating rating = booking.driverRating == null ? null : new Rating(booking.driverRating, booking.ratedAt, booking.reviewText);
        return new View(booking.id, journey, new Person(booking.passengerId, name), booking.seatsBooked,
                booking.pricePerSeatSnapshot, booking.paidFarePaise == null
                        ? booking.pricePerSeatSnapshot.multiply(java.math.BigDecimal.valueOf(booking.seatsBooked))
                        : java.math.BigDecimal.valueOf(booking.paidFarePaise, 2),
                booking.currency, status, booking.version, canCancel, booking.createdAt, booking.updatedAt,
                booking.cancelledAt, booking.cancellationReason, rating, booking.journeyDetails, booking.requestExpiresAt);
    }
    private String effectiveStatus(Booking booking) {
        return "PENDING".equals(booking.status) && !booking.requestExpiresAt.isAfter(clock.instant()) ? "EXPIRED" : booking.status;
    }
    private Results results(Page<Booking> page) {
        return new Results(page.getContent().stream().map(this::view).toList(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
    private static Pageable paging(int page, int size) { return PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"))); }
    private static String optional(String value) { return value == null || value.isBlank() ? null : value.strip(); }
}
