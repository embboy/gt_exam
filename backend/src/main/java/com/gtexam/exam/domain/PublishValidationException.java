package com.gtexam.exam.domain;

public final class PublishValidationException extends RuntimeException {
    private final String code;

    public PublishValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}