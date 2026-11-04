package com.hoopr.auth;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
import java.util.UUID;
public interface TokenRepository extends JpaRepository<RefreshToken, String> {
    @Query("select t.sessionId from RefreshToken t where t.tokenHash = :hash")
    Optional<UUID> findFamily(String hash);
}
