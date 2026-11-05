package com.hoopr.ride;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(name = "hoopr.group.reconcile-enabled", havingValue = "true", matchIfMissing = true)
class GroupPaymentReconciliation {
    private static final Logger log = LoggerFactory.getLogger(GroupPaymentReconciliation.class);
    private final JdbcClient jdbc;
    private final GroupHoldController holds;

    GroupPaymentReconciliation(NamedParameterJdbcTemplate jdbc, GroupHoldController holds) {
        this.jdbc = JdbcClient.create(jdbc);
        this.holds = holds;
    }

    @Scheduled(initialDelayString = "${hoopr.group.reconcile-delay:60000}", fixedDelayString = "${hoopr.group.reconcile-delay:60000}")
    void reconcile() {
        // Claim a bounded batch. The ride lock also serializes these attempts with manual sync.
        var due = jdbc.sql("""
                WITH due AS (
                    SELECT id FROM group_seat_holds
                    WHERE order_id IS NOT NULL AND status NOT IN ('CONFIRMED', 'REFUNDED')
                      AND (last_checked_at IS NULL OR last_checked_at < CURRENT_TIMESTAMP - INTERVAL '1 minute')
                    ORDER BY last_checked_at NULLS FIRST, id LIMIT 10 FOR UPDATE SKIP LOCKED
                )
                UPDATE group_seat_holds h SET last_checked_at = CURRENT_TIMESTAMP
                FROM due WHERE h.id = due.id RETURNING h.id, h.passenger_id
                """).query((row, index) -> new Due(row.getObject("id", UUID.class), row.getObject("passenger_id", UUID.class))).list();
        for (Due hold : due) {
            try {
                holds.reconcile(hold.passenger(), hold.id());
            } catch (RuntimeException failure) {
                log.warn("Group payment reconciliation will retry hold {} ({})", hold.id(), failure.getClass().getSimpleName());
            }
        }
    }

    private record Due(UUID id, UUID passenger) {}
}
