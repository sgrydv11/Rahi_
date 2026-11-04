package com.hoopr.ride;

import java.util.UUID;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;

public interface RideRepository extends JpaRepository<Ride, UUID>, JpaSpecificationExecutor<Ride> {
    // No outer-join entity graph: PostgreSQL must lock just the owning ride row.
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Ride r where r.id = :id")
    Optional<Ride> lockById(UUID id);
    @Override @EntityGraph(attributePaths = "driverProfile")
    Page<Ride> findAll(Specification<Ride> specification, Pageable pageable);
    @Override @EntityGraph(attributePaths = "driverProfile")
    Optional<Ride> findById(UUID id);
}
