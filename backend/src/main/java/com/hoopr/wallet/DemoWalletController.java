package com.hoopr.wallet;
import com.hoopr.auth.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
@RestController @RequestMapping("/api/v1/wallet/demo")
public class DemoWalletController {
 private final JdbcTemplate jdbc;private final AuthService auth;private final boolean enabled;
 public DemoWalletController(JdbcTemplate jdbc,AuthService auth,@Value("${hoopr.wallet.demo-enabled:false}") boolean enabled){this.jdbc=jdbc;this.auth=auth;this.enabled=enabled;}
 public record Amount(@NotNull @Min(100) @Max(1000000) Long amountPaise){@com.fasterxml.jackson.annotation.JsonAnySetter public void unknown(String name,Object value){throw new IllegalArgumentException("Only amountPaise is accepted. Never send card details.");}}
 public record Entry(UUID id,String kind,long amountPaise,Instant createdAt){}
 public record Wallet(boolean enabled,String mode,long balancePaise,List<Entry> entries){}
 private UUID user(Jwt jwt){return auth.profile(UUID.fromString(jwt.getSubject())).id();}
 @GetMapping @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ) public Wallet get(@AuthenticationPrincipal Jwt jwt){return snapshot(user(jwt));}
 @PostMapping("/top-ups") @Transactional public Wallet add(@AuthenticationPrincipal Jwt jwt,@RequestHeader("Idempotency-Key") UUID key,@Valid @RequestBody Amount amount){return mutate(user(jwt),key,amount.amountPaise(),false);}
 @PostMapping("/withdrawals") @Transactional public Wallet withdraw(@AuthenticationPrincipal Jwt jwt,@RequestHeader("Idempotency-Key") UUID key,@Valid @RequestBody Amount amount){return mutate(user(jwt),key,amount.amountPaise(),true);}
 private Wallet mutate(UUID user,UUID key,long amount,boolean withdraw){
  if(!enabled)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Demo wallet is disabled.");
  if(amount<100||amount>1000000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter INR 1–10,000.");
  jdbc.update("INSERT INTO demo_wallets(user_id) VALUES(?) ON CONFLICT DO NOTHING",user);
  long balance=jdbc.queryForObject("SELECT balance_paise FROM demo_wallets WHERE user_id=? FOR UPDATE",Long.class,user);
  String kind=withdraw?"WITHDRAWAL":"TOP_UP";
  var previous=jdbc.queryForList("SELECT kind,amount_paise FROM demo_wallet_entries WHERE user_id=? AND request_key=?",user,key);
  if(!previous.isEmpty()){var old=previous.getFirst();if(!kind.equals(old.get("kind"))||((Number)old.get("amount_paise")).longValue()!=amount)throw new ResponseStatusException(HttpStatus.CONFLICT,"Use a new request key for a different operation.");return snapshot(user);}
  long next=balance+(withdraw?-amount:amount);
  if(next<0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Not enough demo balance.");
  if(next>10000000)throw new ResponseStatusException(HttpStatus.CONFLICT,"Demo balance limit is INR 100,000.");
  jdbc.update("UPDATE demo_wallets SET balance_paise=? WHERE user_id=?",next,user);
  jdbc.update("INSERT INTO demo_wallet_entries(id,user_id,request_key,kind,amount_paise) VALUES(?,?,?,?,?)",UUID.randomUUID(),user,key,kind,amount);
  return snapshot(user);
 }
 private Wallet snapshot(UUID user){
  if(!enabled)return new Wallet(false,"demo",0,List.of());
  var balances=jdbc.queryForList("SELECT balance_paise FROM demo_wallets WHERE user_id=?",user);
  var entries=jdbc.query("SELECT * FROM demo_wallet_entries WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 20",(r,n)->new Entry(r.getObject("id",UUID.class),r.getString("kind"),r.getLong("amount_paise"),r.getTimestamp("created_at").toInstant()),user);
  return new Wallet(true,"demo",balances.isEmpty()?0:((Number)balances.getFirst().get("balance_paise")).longValue(),entries);
 }
}
