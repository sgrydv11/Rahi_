package com.hoopr.user;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ProfileRepository extends JpaRepository<UserProfile, UUID> { }
