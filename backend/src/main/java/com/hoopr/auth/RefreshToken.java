package com.hoopr.auth;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name = "refresh_tokens")
public class RefreshToken {
    @Id @Column(name = "token_hash", length = 64) public String tokenHash;
    @Column(name = "session_id", nullable = false) public UUID sessionId;
    @Column(nullable = false) public boolean consumed;
}
