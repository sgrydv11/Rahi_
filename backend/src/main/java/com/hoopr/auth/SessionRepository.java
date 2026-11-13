package com.hoopr.auth;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
public interface SessionRepository extends JpaRepository<RefreshSession, UUID> {
    @Query("select (count(s)>0) from RefreshSession s, UserAccount u where s.id=:id and s.userId=:userId and u.id=s.userId and s.revoked=false and s.expiresAt>:now and u.status='ACTIVE' and u.role=:role")
    boolean active(UUID id, UUID userId, java.time.Instant now, String role);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from RefreshSession s where s.id = :id")
    Optional<RefreshSession> lockById(UUID id);
}
