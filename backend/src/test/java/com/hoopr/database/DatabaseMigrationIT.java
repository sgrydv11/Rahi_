package com.hoopr.database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** Run explicitly against a dedicated empty PostgreSQL test database. Never cleans data. */
class DatabaseMigrationIT {
    @Test void migrationAndConstraintsWorkOnPostgres() throws Exception {
        String url = required("TEST_DB_URL");
        String username = required("TEST_DB_USERNAME");
        String password = required("TEST_DB_PASSWORD");
        Flyway flyway = Flyway.configure().dataSource(url, username, password).load();
        flyway.migrate();
        assertTrue(flyway.validateWithResult().validationSuccessful);
        try (Connection connection = DriverManager.getConnection(url, username, password)) {
            connection.setAutoCommit(false);
            try {
                UUID id = UUID.randomUUID();
                try (var statement = connection.prepareStatement("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")) {
                    statement.setObject(1, id);
                    statement.setString(2, id + "@example.test");
                    statement.setString(3, "test-only-noncredential-hash");
                    assertEquals(1, statement.executeUpdate());
                }
                try (var statement = connection.prepareStatement("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")) {
                    statement.setObject(1, UUID.randomUUID());
                    statement.setString(2, id + "@example.test");
                    statement.setString(3, "test-only-noncredential-hash");
                    SQLException error = assertThrows(SQLException.class, statement::executeUpdate);
                    assertEquals("23505", error.getSQLState());
                }
            } finally {
                connection.rollback();
            }
        }
    }

    private static String required(String name) {
        return TestDatabase.required(name);
    }
}
