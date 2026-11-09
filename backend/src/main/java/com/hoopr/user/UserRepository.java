package com.hoopr.user;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRepository extends JpaRepository<UserAccount, UUID> {
    boolean existsByMobileNumber(String mobileNumber);
    Optional<UserAccount> findByEmail(String email);
    Optional<UserAccount> findByGoogleSubject(String subject);
}
