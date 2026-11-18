package com.hoopr.auth;
import java.util.UUID;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
final class LegalConsent {
 static final String VERSION="2026-11-18-draft";
 static void record(JdbcTemplate jdbc,UUID user,Instant accepted,String source){record(jdbc,user,VERSION,accepted,source);}
 static void record(JdbcTemplate jdbc,UUID user,String version,Instant accepted,String source){jdbc.update("INSERT INTO user_legal_consents(user_id,terms_version,privacy_version,accepted_at,source) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING",user,version,version,accepted.atOffset(java.time.ZoneOffset.UTC),source);}
 private LegalConsent(){}
}
