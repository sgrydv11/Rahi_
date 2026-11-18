package com.hoopr.wallet;
import com.hoopr.auth.AuthService;
import com.hoopr.database.TestDatabase;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
@SpringBootTest(properties={"hoopr.wallet.demo-enabled=true","hoopr.auth.jwt-secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","hoopr.auth.origins=http://localhost:5173","hoopr.group.reconcile-enabled=false","hoopr.push.enabled=false"}) @AutoConfigureMockMvc
class DemoWalletIT {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.datasource.url",()->TestDatabase.required("TEST_DB_URL"));r.add("spring.datasource.username",()->TestDatabase.required("TEST_DB_USERNAME"));r.add("spring.datasource.password",()->TestDatabase.required("TEST_DB_PASSWORD"));}
 @Autowired DemoWalletController wallet;@Autowired AuthService auth;@Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;List<UUID> users=new ArrayList<>();
 Jwt member(){var user=auth.register(UUID.randomUUID()+"@demo-wallet.test","demo-wallet-test-password","Demo Tester");users.add(user.id());return Jwt.withTokenValue("test").header("alg","HS256").subject(user.id().toString()).build();}
 @AfterEach void cleanup(){for(var id:users){jdbc.update("DELETE FROM user_profiles WHERE user_id=?",id);jdbc.update("DELETE FROM users WHERE id=?",id);}}
 @Test void creditsWithdrawsAndKeepsProviderWalletSeparate(){var user=member();assertEquals(0,wallet.get(user).balancePaise());assertEquals(10000,wallet.add(user,UUID.randomUUID(),new DemoWalletController.Amount(10000L)).balancePaise());assertEquals(7500,wallet.withdraw(user,UUID.randomUUID(),new DemoWalletController.Amount(2500L)).balancePaise());assertEquals(2,wallet.get(user).entries().size());assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM wallets WHERE user_id=?",Integer.class,UUID.fromString(user.getSubject())));}
 @Test void retriesAreIdempotentAndConflictingBodiesFail(){var user=member();var key=UUID.randomUUID();wallet.add(user,key,new DemoWalletController.Amount(1000L));wallet.add(user,key,new DemoWalletController.Amount(1000L));assertEquals(1000,wallet.get(user).balancePaise());assertThrows(org.springframework.web.server.ResponseStatusException.class,()->wallet.add(user,key,new DemoWalletController.Amount(2000L)));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->wallet.withdraw(user,key,new DemoWalletController.Amount(1000L)));assertEquals(1,wallet.get(user).entries().size());}
 @Test void cannotOverdrawOrReadAnotherUsersBalance(){var a=member();var b=member();wallet.add(a,UUID.randomUUID(),new DemoWalletController.Amount(500L));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->wallet.withdraw(a,UUID.randomUUID(),new DemoWalletController.Amount(600L)));assertEquals(500,wallet.get(a).balancePaise());assertEquals(0,wallet.get(b).balancePaise());assertTrue(wallet.get(b).entries().isEmpty());}
 @Test void simultaneousWithdrawalsCannotSpendTheSameBalance() throws Exception {var user=member();wallet.add(user,UUID.randomUUID(),new DemoWalletController.Amount(10000L));var pool=Executors.newFixedThreadPool(2);try{var start=new CountDownLatch(1);Callable<Boolean> work=()->{start.await();try{wallet.withdraw(user,UUID.randomUUID(),new DemoWalletController.Amount(7500L));return true;}catch(org.springframework.web.server.ResponseStatusException e){return false;}};var a=pool.submit(work);var b=pool.submit(work);start.countDown();assertNotEquals(a.get(),b.get());assertEquals(2500,wallet.get(user).balancePaise());}finally{pool.shutdownNow();}}
 @Test void disabledModeRejectsCredits(){var user=member();var disabled=new DemoWalletController(jdbc,auth,false);assertFalse(disabled.get(user).enabled());assertThrows(org.springframework.web.server.ResponseStatusException.class,()->disabled.add(user,UUID.randomUUID(),new DemoWalletController.Amount(100L)));}
 @Test void httpRequiresAuthenticationAndRejectsCardDataOrInvalidAmounts() throws Exception {var user=member();mvc.perform(get("/api/v1/wallet/demo")).andExpect(status().isUnauthorized());var identity=jwt().jwt(j->j.subject(user.getSubject())).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"));mvc.perform(get("/api/v1/wallet/demo").with(identity)).andExpect(status().isOk());for(String body:List.of("{\"amountPaise\":-100}","{\"amountPaise\":100,\"cardNumber\":\"4242424242424242\"}")){mvc.perform(post("/api/v1/wallet/demo/top-ups").with(identity).with(csrf()).header("Idempotency-Key",UUID.randomUUID()).contentType("application/json").content(body)).andExpect(status().isBadRequest());}}
}
