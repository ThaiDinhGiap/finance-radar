package vn.financeradar.domain;

public record IndexSnapshot(long ready, long pending, long failed, long chunks) {}
