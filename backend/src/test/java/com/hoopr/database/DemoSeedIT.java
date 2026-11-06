package com.hoopr.database;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCrypt;
import static org.junit.jupiter.api.Assertions.*;

class DemoSeedIT {
    @Test void seedSupportsLoginsSixRoutesAndRerunsWithoutUndoingCancellations() throws Exception {
        String url = TestDatabase.required("TEST_DB_URL");
        String username = TestDatabase.required("TEST_DB_USERNAME");
        String password = TestDatabase.required("TEST_DB_PASSWORD");
        Flyway.configure().dataSource(url, username, password).load().migrate();
        // Run the actual psql seed inside our rollback-only JDBC transaction.
        String sql = Files.readString(Path.of("seed/demo-data.sql"))
                .replaceAll("(?m)^\\\\set[^\\r\\n]*", "")
                .replaceAll("(?m)^(BEGIN|COMMIT);[\\t ]*\\r?$", "");
        try (Connection db = DriverManager.getConnection(url, username, password)) {
            db.setAutoCommit(false);
            try {
                execute(db, sql);
                assertEquals(100, count(db, "SELECT count(*) FROM users WHERE email LIKE '%@demo.hoopr.test'"));
                assertEquals(30, count(db, "SELECT count(*) FROM vehicles v JOIN users u ON u.id=v.driver_id WHERE u.email LIKE '%@demo.hoopr.test'"));
                assertEquals(180, count(db, "SELECT count(*) FROM rides WHERE notes LIKE '[hoopr-demo-v1]%'"));
                assertEquals(360, count(db, "SELECT count(*) FROM bookings b JOIN rides r ON r.id=b.ride_id WHERE r.notes LIKE '[hoopr-demo-v1]%'"));
                assertEquals(6, count(db, "SELECT count(*) FROM (SELECT source_name,destination_name FROM rides WHERE notes LIKE '[hoopr-demo-v1]%' GROUP BY source_name,destination_name HAVING count(*)=30) routes"));
                assertEquals(0, count(db, "SELECT count(*) FROM rides WHERE notes LIKE '[hoopr-demo-v1]%' AND departure_at<=CURRENT_TIMESTAMP"));
                assertEquals(0, count(db, "SELECT count(*) FROM bookings b JOIN rides r ON r.id=b.ride_id WHERE r.notes LIKE '[hoopr-demo-v1]%' AND b.passenger_id=r.driver_id"));
                try (var query = db.createStatement(); var rows = query.executeQuery("SELECT password_hash FROM users WHERE email='demo001@demo.hoopr.test'")) {
                    assertTrue(rows.next());
                    assertTrue(BCrypt.checkpw("DemoRide@2026!", rows.getString(1)));
                }
                execute(db, """
                    UPDATE bookings SET status='CANCELLED_BY_PASSENGER', cancelled_by=passenger_id,
                        cancelled_at=CURRENT_TIMESTAMP, cancellation_reason='Seed regression test'
                    WHERE id=md5('hoopr-demo-v1:booking:1:1')::uuid;
                    UPDATE rides SET available_seats=available_seats+1
                    WHERE id=md5('hoopr-demo-v1:ride:1')::uuid;
                    """);
                execute(db, sql);
                assertEquals(100, count(db, "SELECT count(*) FROM users WHERE email LIKE '%@demo.hoopr.test'"));
                assertEquals(360, count(db, "SELECT count(*) FROM bookings b JOIN rides r ON r.id=b.ride_id WHERE r.notes LIKE '[hoopr-demo-v1]%'"));
                assertEquals(1, count(db, "SELECT count(*) FROM bookings WHERE id=md5('hoopr-demo-v1:booking:1:1')::uuid AND status='CANCELLED_BY_PASSENGER'"));
                assertEquals(0, count(db, """
                    SELECT count(*) FROM rides r WHERE r.notes LIKE '[hoopr-demo-v1]%'
                    AND r.available_seats <> r.total_seats - (SELECT coalesce(sum(b.seats_booked),0)
                        FROM bookings b WHERE b.ride_id=r.id AND b.status='CONFIRMED')
                    """));
            } finally {
                db.rollback();
            }
        }
    }

    private static void execute(Connection db, String sql) throws Exception {
        try (var statement = db.createStatement()) { statement.execute(sql); }
    }

    private static long count(Connection db, String sql) throws Exception {
        try (var statement = db.createStatement(); var rows = statement.executeQuery(sql)) {
            assertTrue(rows.next());
            return rows.getLong(1);
        }
    }
}
