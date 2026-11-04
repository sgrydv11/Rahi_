package com.hoopr.auth;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
public interface SessionRepository extends JpaRepository<RefreshSession, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from RefreshSession s where s.id = :id")
    Optional<RefreshSession> lockById(UUID id);
}
