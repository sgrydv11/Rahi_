package com.hoopr.wallet;

import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WalletRidePayments {
    private final JdbcClient jdbc;

    public WalletRidePayments(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = JdbcClient.create(jdbc);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean charge(UUID booking, UUID user, long amount) {
        int changed = jdbc.sql("""
                UPDATE wallets SET available_paise = available_paise - :amount
                WHERE user_id = :user AND available_paise >= :amount
                """).param("user", user).param("amount", amount).update();
        if (changed == 0) return false;
        jdbc.sql("""
                INSERT INTO wallet_ride_charges(booking_id, user_id, amount_paise) VALUES (:booking, :user, :amount)
                """).param("booking", booking).param("user", user).param("amount", amount).update();
        entry(user, -amount, "RIDE_DEBIT");
        return true;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void refund(UUID booking) {
        var charge = jdbc.sql("""
                UPDATE wallet_ride_charges SET refunded = TRUE
                WHERE booking_id = :booking AND NOT refunded RETURNING user_id, amount_paise
                """).param("booking", booking).query((row, index) ->
                new Charge(row.getObject("user_id", UUID.class), row.getLong("amount_paise"))).optional();
        charge.ifPresent(value -> {
            jdbc.sql("UPDATE wallets SET available_paise = available_paise + :amount WHERE user_id = :user")
                    .param("user", value.user()).param("amount", value.amount()).update();
            entry(value.user(), value.amount(), "RIDE_REFUND");
        });
    }

    private void entry(UUID user, long amount, String kind) {
        jdbc.sql("INSERT INTO wallet_entries(id, user_id, amount_paise, kind) VALUES (:id, :user, :amount, :kind)")
                .param("id", UUID.randomUUID()).param("user", user).param("amount", amount).param("kind", kind).update();
    }

    private record Charge(UUID user, long amount) {}
}
