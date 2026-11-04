package com.hoopr.ride;

public class RideFailure extends RuntimeException {
    public final int status;
    public RideFailure(int status, String message) { super(message); this.status = status; }
}
