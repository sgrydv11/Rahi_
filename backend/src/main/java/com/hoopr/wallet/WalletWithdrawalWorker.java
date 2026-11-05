package com.hoopr.wallet;

import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration(proxyBeanMethods = false)
@EnableScheduling
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        name = "hoopr.wallet.sandbox-withdrawals-enabled", havingValue = "true", matchIfMissing = true)
class WalletWithdrawalWorker {
    private final JdbcClient jdbc;
    private final WalletController wallet;
    private final boolean succeeds;

    WalletWithdrawalWorker(NamedParameterJdbcTemplate jdbc, WalletController wallet,
                           @Value("${hoopr.wallet.sandbox-withdrawals-succeed:true}") boolean succeeds) {
        this.jdbc = JdbcClient.create(jdbc);
        this.wallet = wallet;
        this.succeeds = succeeds;
    }

    @Scheduled(initialDelayString = "${hoopr.wallet.sandbox-withdrawals-delay:15000}", fixedDelay = 15000)
    void settle() {
        var due = jdbc.sql("""
                SELECT id, user_id FROM wallet_withdrawals WHERE status = 'PENDING'
                ORDER BY created_at, id LIMIT 25
                """).query((row, index) -> new Due(row.getObject("id", UUID.class), row.getObject("user_id", UUID.class)))
                .list();
        for (Due withdrawal : due) wallet.settleWithdrawal(withdrawal.user(), withdrawal.id(), succeeds);
    }

    private record Due(UUID id, UUID user) {}
}
