package com.hoopr.booking;
public class BookingFailure extends RuntimeException {
    public final int status;
    public BookingFailure(int status, String message) { super(message); this.status = status; }
}
