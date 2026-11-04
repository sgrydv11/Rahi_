package com.hoopr.ride;

import java.util.UUID;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;

public interface RideRepository extends JpaRepository<Ride, UUID>, JpaSpecificationExecutor<Ride> {
    @Override @EntityGraph(attributePaths = "driverProfile")
    Page<Ride> findAll(Specification<Ride> specification, Pageable pageable);
    @Override @EntityGraph(attributePaths = "driverProfile")
    Optional<Ride> findById(UUID id);
}
