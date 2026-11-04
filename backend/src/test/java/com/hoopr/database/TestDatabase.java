package com.hoopr.database;

/** Refuse development databases before Flyway or any test fixture can write. */
public final class TestDatabase {
    private TestDatabase() { }
    public static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException("Set " + name + " for PostgreSQL integration tests");
        if (name.equals("TEST_DB_URL") && !value.split("\\?", 2)[0].endsWith("/hoopr_test"))
            throw new IllegalStateException("Integration tests require the dedicated hoopr_test database");
        return value;
    }
}
