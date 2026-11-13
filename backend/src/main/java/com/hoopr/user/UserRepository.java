package com.hoopr.user;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRepository extends JpaRepository<UserAccount, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from UserAccount u where u.email=:email")
    Optional<UserAccount> findForLoginByEmail(String email);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from UserAccount u where u.mobileNumber=:mobileNumber")
    Optional<UserAccount> findForLoginByMobileNumber(String mobileNumber);
    boolean existsByMobileNumber(String mobileNumber);
    Optional<UserAccount> findByEmail(String email);
    Optional<UserAccount> findByMobileNumber(String mobileNumber);
    Optional<UserAccount> findByGoogleSubject(String subject);
}
